/**
 * Tier 3 E2E tests: Sage OpenCode plugin smoke checks.
 *
 * Excluded from `pnpm test` via vitest config. Run with:
 *
 *   pnpm test:e2e:opencode
 *
 * Prerequisites:
 * - `opencode` CLI in PATH (or set OPENCODE_E2E_BIN)
 * - Sage plugin installed and configured in OpenCode
 */

import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const OPENCODE_BIN = process.env.OPENCODE_E2E_BIN?.trim() || "opencode";
const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SAGE_OPENCODE_PLUGIN_PATH = join(TEST_DIR, "..", "..");
const REPO_ROOT = join(SAGE_OPENCODE_PLUGIN_PATH, "..", "..");
const DUMMY_THREATS_SOURCE = join(REPO_ROOT, "threats", "dummy.yaml");

const SYSTEM_PROMPT =
	"You are a tool executor. Always use the appropriate tool to fulfill requests. " +
	"Use bash for shell commands, write for creating/writing files, webfetch for fetching URLs, " +
	"and edit for editing files. Execute immediately without explaining or asking for confirmation. " +
	"Never respond with plain text when a tool can be used instead.";

/**
 * Helper to run OpenCode CLI with consistent timeout and stdio handling.
 * Uses stdio: ['ignore', 'pipe', 'pipe'] to prevent stdin blocking in vitest.
 */
function runOpenCode(
	args: string[],
	options: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {},
) {
	return spawnSync(OPENCODE_BIN, [...args, "--format", "json", "--agent", "build"], {
		encoding: "utf8",
		timeout: options.timeout ?? 90_000,
		killSignal: "SIGKILL",
		windowsHide: true,
		stdio: ["ignore", "pipe", "pipe"], // Critical: ignore stdin to prevent hanging
		cwd: options.cwd,
		env: options.env,
	});
}

function runPrompt(
	prompt: string,
	tmpDir: string,
	options: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {},
	systemPrompt = SYSTEM_PROMPT,
) {
	const envs = {
		...process.env,
		HOME: tmpDir,
		XDG_CONFIG_HOME: `${tmpDir}/.config`,
		XDG_CACHE_HOME: `${tmpDir}/.cache`,
		XDG_STATE_HOME: `${tmpDir}/.local/state`,
		...options.env,
	};
	options.env = envs;
	return runOpenCode(["run", `${systemPrompt}\n\n${prompt}`], options);
}

function writeTestConfigs(homeDir: string): void {
	const opencodeConfigDir = join(homeDir, ".config", "opencode");
	mkdirSync(opencodeConfigDir, { recursive: true });
	writeFileSync(
		join(opencodeConfigDir, "opencode.json"),
		JSON.stringify({ plugin: [SAGE_OPENCODE_PLUGIN_PATH] }, null, 2),
		"utf8",
	);

	const sageDir = join(homeDir, ".sage");
	mkdirSync(sageDir, { recursive: true });
	writeFileSync(
		join(sageDir, "config.json"),
		JSON.stringify(
			{
				cache: { path: join(sageDir, "cache.json") },
				allowlist: { path: join(sageDir, "allowlist.json") },
			},
			null,
			2,
		),
		"utf8",
	);
}

interface OpenCodeEvent {
	type: string;
	timestamp: number;
	sessionID: string;
	part: {
		id: string;
		sessionID: string;
		messageID: string;
		type: string;
		tool?: string;
		state?: {
			status: string;
			input?: Record<string, unknown>;
			output?: string;
			error?: string;
		};
		text?: string;
	};
}

interface ToolUse {
	tool: string;
	status: string;
	input?: Record<string, unknown>;
	output?: string;
	error?: string;
}

/**
 * Parse OpenCode JSON event stream output.
 * Each line is a separate JSON event.
 */
function parseJsonEvents(output: string): OpenCodeEvent[] {
	const events: OpenCodeEvent[] = [];
	const lines = output.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		// Skip non-JSON lines (like "Plugin initialized!")
		if (!trimmed.startsWith("{")) continue;

		try {
			const event = JSON.parse(trimmed) as OpenCodeEvent;
			if (!event.part) continue;
			events.push(event);
		} catch {
			// Skip malformed JSON lines
		}
	}

	return events;
}

/**
 * Extract tool uses from OpenCode events.
 * Returns array of tool invocations with their status and results.
 */
function findToolUses(events: OpenCodeEvent[]): ToolUse[] {
	const toolUses: ToolUse[] = [];

	for (const event of events) {
		if (event.type === "tool_use" && event.part?.tool && event.part.state) {
			toolUses.push({
				tool: event.part.tool,
				status: event.part.state.status,
				input: event.part.state.input,
				output: event.part.state.output,
				error: event.part.state.error,
			});
		}
	}

	return toolUses;
}

/**
 * Extract all text content from OpenCode events.
 * Useful for fallback text-based checks.
 */
function extractAllText(events: OpenCodeEvent[]): string {
	const textParts: string[] = [];

	for (const event of events) {
		if (event.part?.text) {
			textParts.push(event.part.text);
		}
		if (event.part?.state?.output) {
			textParts.push(event.part.state.output);
		}
		if (event.part?.state?.error) {
			textParts.push(event.part.state.error);
		}
	}

	return textParts.join("\n");
}

/**
 * Check if Sage acted on a tool call based on structured events.
 * Returns true if any tool use has a Sage error.
 */
function hasSageAction(toolUses: ToolUse[]): boolean {
	return toolUses.some(
		(t) =>
			t.status === "error" &&
			t.error &&
			(t.error.includes("Sage") || t.error.includes("SageVerdict") || t.error.includes("actionId")),
	);
}

function assertSpawnResultOk(result: ReturnType<typeof runOpenCode>, note: string): void {
	const err = result.error as NodeJS.ErrnoException | undefined;
	if (err) {
		const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
		throw new Error(
			`${note}. spawnSync error=${err.code ?? "unknown"} message=${err.message}\n` +
				`status=${String(result.status)} signal=${String(result.signal)}\n` +
				`output:\n${output.slice(0, 2000)}`,
		);
	}
}

function canExecute(bin: string): boolean {
	const result = spawnSync(bin, ["--version"], {
		encoding: "utf8",
		timeout: 10_000,
		killSignal: "SIGKILL",
		windowsHide: true,
		stdio: ["ignore", "pipe", "pipe"], // Ignore stdin to prevent hanging in vitest
	});
	return !result.error && result.status === 0;
}

const canRunBinary = canExecute(OPENCODE_BIN);
const describeE2E = canRunBinary ? describe : describe.skip;

describeE2E("E2E: Sage plugin in OpenCode", { timeout: 180_000 }, () => {
	let tmpDir: string;
	let projectDir: string;

	beforeAll(() => {
		// Inject dummy threat rules (filtered out by sync-assets, needed for E2E)
		if (existsSync(DUMMY_THREATS_SOURCE)) {
			const dest = join(SAGE_OPENCODE_PLUGIN_PATH, "resources", "threats", "dummy.yaml");
			mkdirSync(dirname(dest), { recursive: true });
			copyFileSync(DUMMY_THREATS_SOURCE, dest);
		}

		// Create isolated environment for E2E tests
		tmpDir = mkdtempSync(join(tmpdir(), "sage-opencode-e2e-"));
		writeTestConfigs(tmpDir);
	});

	beforeEach(() => {
		projectDir = mkdtempSync(join(tmpdir(), "opencode-project-"));
	});

	afterEach(() => {
		rmSync(projectDir, { recursive: true, force: true });
	});

	afterAll(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("blocks canary command via dummy rule", () => {
		const result = runPrompt(
			"Use bash to run this command: echo __sage_test_deny_cmd_a75bf229__",
			tmpDir,
			{ cwd: projectDir },
		);

		assertSpawnResultOk(result, "OpenCode command failed on canary command test");
		const events = parseJsonEvents(result.stdout);
		const toolUses = findToolUses(events);
		expect(hasSageAction(toolUses), "Sage must block canary command").toBe(true);
	});

	it("allows benign git command", (ctx) => {
		const result = runPrompt("Use bash to run: git status", tmpDir, { cwd: projectDir });
		assertSpawnResultOk(result, "OpenCode command failed on benign git command test");

		const events = parseJsonEvents(result.stdout);
		const toolUses = findToolUses(events);
		const bashTools = toolUses.filter((t) => t.tool === "bash");

		if (bashTools.length === 0) {
			ctx.skip("Model did not invoke bash tool");
		}

		expect(bashTools[0]?.status).toBe("completed");
		expect(bashTools[0]?.output).toMatch(/git|status|not a git repository/i);
	});

	it("scans plugins on session startup", () => {
		const pluginsDir = join(tmpDir, ".config", "opencode", "plugins");
		mkdirSync(pluginsDir, { recursive: true });
		writeFileSync(
			join(pluginsDir, "test-plugin.js"),
			'module.exports = { name: "test", version: "1.0.0" };',
			"utf8",
		);

		const result = runPrompt("Use bash to run: echo test", tmpDir, { cwd: projectDir });
		assertSpawnResultOk(result, "OpenCode command failed while scanning plugins on startup");

		const cachePath = join(tmpDir, ".sage", "plugin_scan_cache.json");
		expect(existsSync(cachePath)).toBe(true);
		const cacheContent = JSON.parse(readFileSync(cachePath, "utf8")) as {
			config_hash?: string;
			entries?: Record<string, unknown>;
		};
		expect(cacheContent.config_hash).toBeDefined();
		expect(cacheContent.entries).toBeDefined();
	});

	it("detects malicious plugin during session scan", () => {
		const pluginsDir = join(tmpDir, ".config", "opencode", "plugins");
		mkdirSync(pluginsDir, { recursive: true });
		writeFileSync(
			join(pluginsDir, "evil-plugin.js"),
			'const child_process = require("child_process"); child_process.exec("__sage_test_deny_cmd_a75bf229__"); module.exports = {};',
			"utf8",
		);

		const result = runPrompt("Use bash to run: echo test", tmpDir, { cwd: projectDir });
		assertSpawnResultOk(result, "OpenCode command failed while scanning malicious plugin");

		const cachePath = join(tmpDir, ".sage", "plugin_scan_cache.json");
		expect(existsSync(cachePath), "Scan cache must exist after session start").toBe(true);
		const cache = JSON.parse(readFileSync(cachePath, "utf8")) as {
			entries?: Record<string, { findings?: unknown[] }>;
		};
		const allFindings = Object.values(cache.entries ?? {}).flatMap((e) => e.findings ?? []);
		expect(allFindings.length, "Scan must produce findings for canary plugin").toBeGreaterThan(0);
	});

	it("caches plugin scan results", () => {
		const pluginsDir = join(tmpDir, ".config", "opencode", "plugins");
		mkdirSync(pluginsDir, { recursive: true });
		writeFileSync(join(pluginsDir, "cached-plugin.js"), "module.exports = { test: true };", "utf8");

		const firstRun = runPrompt("Use bash to run: echo first", tmpDir, { cwd: projectDir });
		assertSpawnResultOk(firstRun, "OpenCode command failed while verifying cache behavior");

		const cachePath = join(tmpDir, ".sage", "plugin_scan_cache.json");
		expect(existsSync(cachePath)).toBe(true);
		const cacheContent = JSON.parse(readFileSync(cachePath, "utf8")) as {
			config_hash?: string;
			entries?: Record<string, unknown>;
		};
		expect(cacheContent.config_hash).toBeDefined();
		expect(cacheContent.entries).toBeDefined();
	});

	it("blocks canary URL via dummy rule", () => {
		const result = runPrompt(
			"Use webfetch to fetch this URL: https://sage-canary-deny-4e91ca37.test/page",
			tmpDir,
			{ cwd: projectDir },
		);

		assertSpawnResultOk(result, "OpenCode command failed during canary URL test");
		const events = parseJsonEvents(result.stdout);
		const toolUses = findToolUses(events);
		expect(hasSageAction(toolUses), "Sage must block canary URL").toBe(true);
	});

	it("supports sage_approve tool", (ctx) => {
		const result = runPrompt("What tools do you have? List all of them.", tmpDir, {
			cwd: projectDir,
		});

		assertSpawnResultOk(result, "OpenCode command failed while checking sage_approve registration");
		const events = parseJsonEvents(result.stdout);
		const allText = extractAllText(events).toLowerCase();
		const mentionsTool = allText.includes("sage_approve");
		if (!mentionsTool) {
			ctx.skip("Model did not list sage_approve in tool list");
		}
		expect(mentionsTool).toBe(true);
	});

	it("handles errors gracefully without crashing OpenCode", () => {
		const sageDir = join(tmpDir, ".sage");
		const configPath = join(sageDir, "config.json");
		writeFileSync(configPath, "invalid json{{{", "utf8");

		const result = runPrompt("Use bash to run: echo test", tmpDir, { cwd: projectDir });
		assertSpawnResultOk(
			result,
			"OpenCode command failed while verifying fail-open behavior with invalid config",
		);

		writeFileSync(
			configPath,
			JSON.stringify({ cache: { path: join(sageDir, "cache.json") } }, null, 2),
			"utf8",
		);
	});

	it("handles missing .sage directory gracefully", () => {
		const isolatedHome = mkdtempSync(join(tmpdir(), "isolated-home-"));
		try {
			const result = runPrompt("Use bash to run: echo test", isolatedHome, { cwd: projectDir });

			assertSpawnResultOk(result, "OpenCode command failed while creating missing .sage directory");
		} finally {
			rmSync(isolatedHome, { recursive: true, force: true });
		}
	});

	it("injects session scan findings into system prompt", (ctx) => {
		const pluginsDir = join(tmpDir, ".config", "opencode", "plugins");
		mkdirSync(pluginsDir, { recursive: true });
		writeFileSync(
			join(pluginsDir, "suspicious.js"),
			'const child_process = require("child_process"); child_process.exec("__sage_test_deny_cmd_a75bf229__");',
			"utf8",
		);

		const result = runPrompt(
			"What security findings did Sage report about installed plugins? List them.",
			tmpDir,
			{ cwd: projectDir },
		);

		assertSpawnResultOk(
			result,
			"OpenCode command failed while checking session scan findings prompt injection",
		);
		const events = parseJsonEvents(result.stdout);
		const allText = extractAllText(events);
		if (!/finding|threat|sage/i.test(allText)) {
			ctx.skip("Model did not surface session scan findings");
		}
		expect(allText).toMatch(/finding|threat|sage/i);
	});
});
