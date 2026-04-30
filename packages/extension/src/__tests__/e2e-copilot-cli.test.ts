/**
 * Tier 3 E2E tests: Sage hooks running inside GitHub Copilot CLI.
 *
 * The VS Code extension installs managed hooks into ~/.copilot/hooks/hooks.json.
 * Copilot CLI reads from the same path, so these tests verify that Sage
 * protection works end-to-end when Copilot CLI triggers tool calls.
 *
 * Uses `--plugin-dir` to load hooks from a temporary plugin directory —
 * no changes are made to the real ~/.copilot/ config.
 *
 * Excluded from `pnpm test`. Run with:
 *
 *   pnpm test:e2e:copilot-cli
 *
 * Prerequisites:
 * - `copilot` CLI in PATH (install via https://docs.github.com/copilot)
 * - Authenticated (`copilot login` or GITHUB_TOKEN / GH_TOKEN / COPILOT_GITHUB_TOKEN)
 * - packages/extension already built (handled by Vitest global setup)
 *
 * The suite auto-skips if `copilot` is not in PATH. Missing auth is NOT
 * detected — the CLI will fail with auth errors at runtime.
 */

import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const EXTENSION_ROOT = path.resolve(__dirname, "..", "..");
const HOOK_RUNNER_PATH = path.resolve(EXTENSION_ROOT, "dist", "sage-hook.cjs");
const AUDIT_PATH = path.join(homedir(), ".sage", "audit.jsonl");

/**
 * Model to use for Copilot CLI E2E tests.
 * Override via COPILOT_E2E_MODEL env var. Defaults to claude-haiku-4.5
 * for reliable tool-calling behavior and lower cost.
 */
const COPILOT_MODEL = process.env.COPILOT_E2E_MODEL ?? "claude-haiku-4.5";

const BASH_PREFIX =
	"You are a CLI assistant. When given a command, run it using the bash tool. " +
	"Reply only with the tool call, no commentary.\n\n" +
	"Run this command: ";

const FILE_PREFIX =
	"You are a CLI assistant. When given a file task, use a file tool (create or edit). " +
	"Reply only with the tool call, no commentary.\n\n";

const FETCH_PREFIX =
	"You are a CLI assistant. When given a URL, fetch it using web_fetch or bash curl. " +
	"Reply only with the tool call, no commentary.\n\n";

// --- Types ---

interface CopilotEvent {
	type: string;
	data?: Record<string, unknown>;
	[key: string]: unknown;
}

interface ToolResult {
	toolCallId: string;
	toolName: string;
	success: boolean;
	errorCode?: string;
	errorMessage?: string;
	resultContent?: string;
}

// --- Prerequisite check ---

function copilotAvailable(): boolean {
	try {
		const result = spawnSync("copilot", ["--version"], {
			encoding: "utf8",
			timeout: 20_000,
			windowsHide: true,
		});
		return !result.error && result.status === 0;
	} catch {
		return false;
	}
}

const HAS_COPILOT = copilotAvailable();
if (!HAS_COPILOT) {
	console.warn("Copilot CLI E2E skipped: `copilot` not found in PATH or not authenticated");
}

// --- Helpers ---

function runCopilot(
	prompt: string,
	opts: { pluginDir: string; timeout?: number; promptPrefix?: string },
): { events: CopilotEvent[]; raw: string; exitCode: number | null } {
	const timeout = opts.timeout ?? 120_000;
	const prefix = opts.promptPrefix ?? BASH_PREFIX;
	const fullPrompt = `${prefix}${prompt}`;

	const args = [
		"-p",
		fullPrompt,
		"--model",
		COPILOT_MODEL,
		"--allow-all",
		"--output-format",
		"json",
		"--no-auto-update",
		"--no-custom-instructions",
		"--plugin-dir",
		opts.pluginDir,
	];

	let result: SpawnSyncReturns<string>;
	try {
		result = spawnSync("copilot", args, {
			encoding: "utf8",
			timeout,
			maxBuffer: 10 * 1024 * 1024,
			windowsHide: true,
		});
	} catch (e) {
		return { events: [], raw: String(e), exitCode: null };
	}

	const stdout = result.stdout ?? "";
	const stderr = result.stderr ?? "";
	if (result.error) {
		console.error("copilot spawn error:", result.error);
	}
	if (stderr.trim()) {
		console.error("copilot stderr:", stderr);
	}

	const events: CopilotEvent[] = [];
	for (const line of stdout.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			events.push(JSON.parse(trimmed) as CopilotEvent);
		} catch {
			// Skip non-JSON lines.
		}
	}

	return { events, raw: `${stdout}\n${stderr}`, exitCode: result.status };
}

/** Log event types and errors for debugging failed tests. */
function dumpDiagnostics(events: CopilotEvent[], raw: string): void {
	const types = events.map((e) => e.type);
	console.error(`[copilot-e2e] ${events.length} events: ${types.join(", ")}`);

	const errors = events.filter((e) => e.type === "session.error");
	for (const err of errors) {
		console.error("[copilot-e2e] session.error:", JSON.stringify(err.data));
	}

	// Show assistant messages (the model may have responded with text instead of tools).
	const messages = events.filter((e) => e.type === "assistant.message");
	for (const msg of messages) {
		const content = (msg.data as Record<string, unknown>)?.content;
		if (content) console.error("[copilot-e2e] assistant.message:", String(content).slice(0, 300));
	}

	if (events.length === 0) {
		console.error("[copilot-e2e] raw output (first 500 chars):", raw.slice(0, 500));
	}
}

function findToolResults(events: CopilotEvent[]): ToolResult[] {
	// toolName is only present on tool.execution_start events.
	// Correlate via toolCallId to get the name for completion events.
	const toolNameById = new Map<string, string>();
	for (const event of events) {
		if (event.type !== "tool.execution_start") continue;
		const data = event.data;
		if (!data) continue;
		const id = data.toolCallId as string;
		const name = data.toolName as string;
		if (id && name) toolNameById.set(id, name);
	}

	const results: ToolResult[] = [];
	for (const event of events) {
		if (event.type !== "tool.execution_complete") continue;
		const data = event.data;
		if (!data) continue;

		const toolCallId = (data.toolCallId as string) ?? "";
		const toolName = (data.toolName as string) ?? toolNameById.get(toolCallId) ?? "";
		const success = (data.success as boolean) ?? false;

		const error = data.error as Record<string, unknown> | undefined;
		const errorCode = (error?.code as string) ?? undefined;
		const errorMessage = (error?.message as string) ?? undefined;

		const resultObj = data.result as Record<string, unknown> | undefined;
		const resultContent = (resultObj?.content as string) ?? undefined;

		// Skip internal tools like report_intent.
		if (toolName === "report_intent") continue;

		results.push({ toolCallId, toolName, success, errorCode, errorMessage, resultContent });
	}
	return results;
}

function hasSageVerdictInAudit(
	auditPath: string,
	expectedVerdict: string,
	marker?: string,
): boolean {
	if (!existsSync(auditPath)) return false;

	const lines = readFileSync(auditPath, "utf8").split(/\r?\n/);
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			const entry = JSON.parse(trimmed) as Record<string, unknown>;
			if (entry.type !== "runtime_verdict") continue;
			if (entry.verdict !== expectedVerdict) continue;
			if (marker) {
				const summary = String(entry.tool_input_summary ?? "").toLowerCase();
				if (!summary.includes(marker.toLowerCase())) continue;
			}
			return true;
		} catch {
			// Ignore malformed lines.
		}
	}
	return false;
}

// --- Fixture setup ---

interface CopilotFixture {
	pluginDir: string;
}

function createCopilotFixture(): CopilotFixture {
	const pluginDir = mkdtempSync(path.join(tmpdir(), "sage-copilot-cli-e2e-"));

	// Plugin manifest (required by --plugin-dir).
	writeFileSync(
		path.join(pluginDir, "plugin.json"),
		JSON.stringify({ name: "sage-e2e", version: "0.0.0", description: "Sage E2E test plugin" }),
		"utf8",
	);

	// Copy sage-hook runner + resources.
	const distDir = path.join(pluginDir, "dist");
	const resourcesDir = path.join(pluginDir, "resources");

	mkdirSync(distDir, { recursive: true });
	cpSync(HOOK_RUNNER_PATH, path.join(distDir, "sage-hook.cjs"), { force: true });
	const sourceMap = `${HOOK_RUNNER_PATH}.map`;
	if (existsSync(sourceMap)) {
		cpSync(sourceMap, path.join(distDir, "sage-hook.cjs.map"), { force: true });
	}

	cpSync(path.join(EXTENSION_ROOT, "resources"), resourcesDir, {
		recursive: true,
		force: true,
	});

	// Write hooks into the plugin directory.
	const runnerPath = path.join(distDir, "sage-hook.cjs");
	const nodePath = process.execPath;
	const hooksDir = path.join(pluginDir, "hooks");
	mkdirSync(hooksDir, { recursive: true });

	const hookCommand = `ELECTRON_RUN_AS_NODE=1 "${nodePath}" "${runnerPath}" vscode`;
	writeFileSync(
		path.join(hooksDir, "hooks.json"),
		`${JSON.stringify(
			{
				hooks: {
					PreToolUse: [
						{
							type: "command",
							command: hookCommand,
							timeout: 30,
						},
					],
				},
			},
			null,
			2,
		)}\n`,
		"utf8",
	);

	return { pluginDir };
}

function cleanupFixture(fixture: CopilotFixture): void {
	rmSync(fixture.pluginDir, { recursive: true, force: true });
}

// --- Tests ---

const describeSuite = HAS_COPILOT ? describe : describe.skip;

describeSuite("E2E: Copilot CLI + Sage hooks", { timeout: 300_000 }, () => {
	let fixture: CopilotFixture;

	beforeAll(() => {
		fixture = createCopilotFixture();
	});

	afterAll(() => {
		if (fixture) {
			cleanupFixture(fixture);
		}
	});

	it("hooks load and allow benign shell command", () => {
		const { events, raw } = runCopilot("echo hello_copilot_e2e_test", {
			pluginDir: fixture.pluginDir,
		});
		const results = findToolResults(events);
		const bash = results.filter((r) => r.toolName === "bash");

		if (bash.length === 0) dumpDiagnostics(events, raw);
		expect(bash.length, "Model must use bash tool at least once").toBeGreaterThanOrEqual(1);
		const match = bash.find(
			(b) => b.success && b.resultContent?.includes("hello_copilot_e2e_test"),
		);
		expect(match, "At least one bash result must contain hello_copilot_e2e_test").toBeTruthy();
	});

	it("blocks canary command via dummy rule", () => {
		const { events, raw } = runCopilot("echo __sage_test_deny_cmd_a75bf229__", {
			pluginDir: fixture.pluginDir,
		});
		const results = findToolResults(events);
		const bash = results.filter((r) => r.toolName === "bash");

		if (bash.length === 0) dumpDiagnostics(events, raw);
		expect(bash.length, "Model must attempt bash tool").toBeGreaterThanOrEqual(1);
		const denied = bash.find((b) => !b.success && b.errorCode === "denied");
		expect(denied, "bash tool must be denied by hook").toBeTruthy();
		expect(
			hasSageVerdictInAudit(AUDIT_PATH, "deny", "__sage_test_deny_cmd_a75bf229__"),
			"Audit log must contain deny verdict for canary command",
		).toBe(true);
	});

	it("blocks canary URL via dummy rule", () => {
		const { events, raw } = runCopilot("echo visit https://sage-canary-deny-4e91ca37.test/page", {
			pluginDir: fixture.pluginDir,
		});
		const results = findToolResults(events);
		const bash = results.filter((r) => r.toolName === "bash");

		if (bash.length === 0) dumpDiagnostics(events, raw);
		expect(bash.length, "Model must attempt bash tool").toBeGreaterThanOrEqual(1);
		const denied = bash.find((b) => !b.success && b.errorCode === "denied");
		expect(denied, "bash tool must be denied by hook (canary URL)").toBeTruthy();
	});

	it("blocks second canary command via dummy rule", () => {
		const { events, raw } = runCopilot(
			"echo __sage_test_ask_cmd_8f2e6b71__ && echo __sage_test_deny_cmd_a75bf229__",
			{ pluginDir: fixture.pluginDir },
		);
		const results = findToolResults(events);
		const bash = results.filter((r) => r.toolName === "bash");

		if (bash.length === 0) dumpDiagnostics(events, raw);
		expect(bash.length, "Model must attempt bash tool").toBeGreaterThanOrEqual(1);
		const denied = bash.find((b) => !b.success && b.errorCode === "denied");
		expect(denied, "bash tool must be denied by hook").toBeTruthy();
	});

	it("ask verdict fires for canary ask command", () => {
		const { events, raw } = runCopilot("echo __sage_test_ask_cmd_8f2e6b71__", {
			pluginDir: fixture.pluginDir,
		});
		const results = findToolResults(events);
		const bash = results.filter((r) => r.toolName === "bash");

		if (bash.length === 0) dumpDiagnostics(events, raw);
		expect(bash.length, "Model must attempt bash tool").toBeGreaterThanOrEqual(1);
		// ask verdict is also denied in non-interactive mode.
		const denied = bash.find((b) => !b.success && b.errorCode === "denied");
		expect(denied, "bash tool must be denied by hook (canary ask)").toBeTruthy();
		expect(
			hasSageVerdictInAudit(AUDIT_PATH, "ask", "__sage_test_ask_cmd_8f2e6b71__"),
			"Audit log must contain ask verdict for canary ask command",
		).toBe(true);
	});

	it("blocks canary file path via file tool", () => {
		const { events, raw } = runCopilot(
			"Create a file at /tmp/__sage_test_deny_file_e6c4a918__.txt with the exact content: hello",
			{ pluginDir: fixture.pluginDir, promptPrefix: FILE_PREFIX },
		);
		const results = findToolResults(events);

		// Model may use create, edit, or bash — any tool that triggers the canary is valid.
		const denied = results.find((r) => !r.success && r.errorCode === "denied");
		if (!denied) {
			dumpDiagnostics(events, raw);
			if (results.length === 0) {
				expect.fail("Model did not use any tool");
			}
			expect.fail(
				`Model used tool(s) [${results.map((r) => r.toolName).join(", ")}] but none were denied`,
			);
		}

		expect(
			hasSageVerdictInAudit(AUDIT_PATH, "deny", "__sage_test_deny_file_e6c4a918__"),
			"Audit log must contain deny verdict for canary file path",
		).toBe(true);
	});

	it("blocks canary URL via fetch tool", () => {
		const { events, raw } = runCopilot(
			"Fetch the content at https://sage-canary-deny-4e91ca37.test/page and show me the response",
			{ pluginDir: fixture.pluginDir, promptPrefix: FETCH_PREFIX },
		);
		const results = findToolResults(events);

		// Model may use web_fetch or bash+curl — any tool that triggers the canary is valid.
		const denied = results.find((r) => !r.success && r.errorCode === "denied");
		if (!denied) {
			dumpDiagnostics(events, raw);
			if (results.length === 0) {
				expect.fail("Model did not use any tool");
			}
			expect.fail(
				`Model used tool(s) [${results.map((r) => r.toolName).join(", ")}] but none were denied`,
			);
		}

		expect(
			hasSageVerdictInAudit(AUDIT_PATH, "deny", "sage-canary-deny-4e91ca37"),
			"Audit log must contain deny verdict for canary URL",
		).toBe(true);
	});
});
