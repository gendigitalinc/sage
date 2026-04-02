/**
 * Tier 3 E2E tests: Sage plugin running inside Claude CLI.
 *
 * Excluded from `pnpm test` via vitest config. Run with:
 *
 *   pnpm test:e2e
 *
 * Prerequisites:
 * - `claude` CLI in PATH
 * - Valid API credentials (ANTHROPIC_API_KEY)
 * - Sage must NOT be installed via Claude Code marketplace (duplicate-plugin conflict)
 * - ~$0.03 per test (Haiku model)
 */

import { type ExecFileSyncOptions, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "..");

// --- Helpers ---

interface ToolResult {
	toolName: string;
	toolInput: Record<string, unknown>;
	isError: boolean;
	resultContent: string;
}

const DEFAULT_SYSTEM_PROMPT =
	"You are a CLI tool executor. Always use the appropriate tool to fulfill requests. " +
	"Use Bash for shell commands, Write for creating/writing files, WebFetch for fetching " +
	"URLs, Edit for editing files. Execute immediately without explaining or asking for " +
	"confirmation. Never respond with plain text when a tool can be used instead.";

function runClaude(
	prompt: string,
	opts: { systemPrompt?: string; maxTurns?: number } = {},
): { messages: Record<string, unknown>[]; debugLog: string } {
	const debugTempDir = mkdtempSync(join(tmpdir(), "sage-e2e-"));
	try {
		const debugFile = join(debugTempDir, "debug.log");

		const systemPrompt = opts.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
		const maxTurns = opts.maxTurns ?? 3;

		const args = [
			"--print",
			"--output-format",
			"stream-json",
			"--verbose",
			"--no-session-persistence",
			"--max-turns",
			String(maxTurns),
			"--model",
			"haiku",
			"--plugin-dir",
			PLUGIN_ROOT,
			"--debug-file",
			debugFile,
			"--allowedTools",
			"WebFetch,Read",
			"--disallowedTools",
			"mcp__*",
			"--add-dir",
			homedir(),
			"--system-prompt",
			systemPrompt,
			"-p",
			prompt,
		];

		const execOpts: ExecFileSyncOptions = {
			timeout: 120_000,
			maxBuffer: 10 * 1024 * 1024,
			stdio: "pipe",
		};

		let stdout: string;
		try {
			stdout = execFileSync("claude", args, execOpts).toString();
		} catch (e) {
			const err = e as { stdout?: Buffer; stderr?: Buffer };
			stdout = err.stdout?.toString() ?? "";
			console.error("claude error: ", stdout, err.stderr?.toString());
		}

		const messages: Record<string, unknown>[] = [];
		for (const line of stdout.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			try {
				const parsed = JSON.parse(trimmed) as Record<string, unknown>;
				console.debug(
					parsed,
					JSON.stringify((parsed.message as Record<string, string>)?.content || []),
				);
				messages.push(parsed);
			} catch {
				// skip non-JSON lines
			}
		}

		let debugLog = "";
		try {
			debugLog = readFileSync(debugFile, "utf-8");
		} catch {
			// debug file may not exist
		}

		return { messages, debugLog };
	} finally {
		rmSync(debugTempDir, { recursive: true, force: true });
	}
}

function findToolResults(messages: Record<string, unknown>[]): ToolResult[] {
	const results: ToolResult[] = [];

	// Build map of tool_use_id -> (name, input) from assistant messages
	const toolCalls = new Map<string, { name: string; input: Record<string, unknown> }>();
	for (const msg of messages) {
		if (msg.type !== "assistant") continue;
		const inner = (msg.message ?? msg) as Record<string, unknown>;
		const content = inner.content as Array<Record<string, unknown>> | undefined;
		if (!content) continue;
		for (const block of content) {
			if (block.type === "tool_use") {
				toolCalls.set(block.id as string, {
					name: block.name as string,
					input: (block.input as Record<string, unknown>) ?? {},
				});
			}
		}
	}

	// Match tool_results from user messages
	for (const msg of messages) {
		if (msg.type !== "user") continue;
		const inner = (msg.message ?? msg) as Record<string, unknown>;
		const content = inner.content as Array<Record<string, unknown>> | undefined;
		if (!content) continue;
		for (const block of content) {
			if (block.type !== "tool_result") continue;
			const toolUseId = block.tool_use_id as string;
			const call = toolCalls.get(toolUseId);
			if (!call) continue;

			const isError = (block.is_error as boolean) ?? false;
			let resultContent = "";
			const blockContent = block.content;
			if (typeof blockContent === "string") {
				resultContent = blockContent;
			} else if (Array.isArray(blockContent)) {
				const parts: string[] = [];
				for (const part of blockContent) {
					if (typeof part === "string") parts.push(part);
					else if (
						typeof part === "object" &&
						part !== null &&
						(part as Record<string, unknown>).type === "text"
					) {
						parts.push((part as Record<string, unknown>).text as string);
					}
				}
				resultContent = parts.join("\n");
			}

			results.push({
				toolName: call.name,
				toolInput: call.input,
				isError,
				resultContent,
			});
		}
	}

	return results;
}

function getResultMessage(messages: Record<string, unknown>[]): Record<string, unknown> | null {
	return messages.find((m) => m.type === "result") || null;
}

// --- Tests ---

describe("E2E: Sage plugin in Claude CLI", { timeout: 180_000 }, () => {
	it("loads plugin and allows benign command", (_ctx) => {
		const { messages } = runClaude("Use the Bash tool to run this command: echo hello_e2e_test");
		const results = findToolResults(messages);
		const bash = results.filter((r) => r.toolName === "Bash");

		expect(bash.length, "Model must use Bash tool at least once").toBeGreaterThanOrEqual(1);
		const match = bash.find((b) => !b.isError && b.resultContent?.includes("hello_e2e_test"));
		expect(match, "At least one Bash result must contain hello_e2e_test").toBeTruthy();
	});

	it("session-start hook fires without crashing", () => {
		const { messages } = runClaude("Say 'hello'");
		expect(messages.length).toBeGreaterThan(0);
	});

	it("security-awareness skill is loaded into model context", () => {
		const { messages } = runClaude(
			"What security plugin is protecting this environment? Just name it.",
			{ maxTurns: 1 },
		);
		const allText = (getResultMessage(messages)?.result as string).toLowerCase() ?? "";
		// SKILL.md says "protected by Sage, a security plugin" — model should reference it
		const knowsSage = allText.includes("sage");
		// Fallback: model references security concepts from the skill without naming Sage
		const knowsSecurityContext = ["security plugin", "security awareness", "anti-malware"].some(
			(kw) => allText.includes(kw),
		);
		expect(knowsSage || knowsSecurityContext).toBe(true);
	});

	it("blocks canary command via dummy rule", () => {
		const { messages } = runClaude(
			"Use the Bash tool to run this command: echo __sage_test_deny_cmd_a75bf229__",
		);
		const results = findToolResults(messages);
		const bash = results.filter((r) => r.toolName === "Bash");
		expect(bash.length, "Model must attempt Bash tool").toBe(1);
		expect(bash[0].isError).toBe(true);
		expect(bash[0].resultContent).toMatch(/denied|Blocked/i);
	});

	it("blocks canary URL via dummy rule", () => {
		const { messages } = runClaude(
			"Use the WebFetch tool to fetch this URL: https://sage-canary-deny-4e91ca37.test/page",
		);
		const results = findToolResults(messages);
		const fetches = results.filter((r) => r.toolName === "WebFetch");
		expect(fetches.length, "Model must attempt WebFetch tool").toBe(1);
		expect(fetches[0].isError).toBe(true);
		expect(fetches[0].resultContent).toMatch(/denied|Blocked/i);
	});

	it("blocks canary file path via dummy rule", () => {
		const { messages } = runClaude(
			"Use the Write tool to create a file called __sage_test_deny_file_e6c4a918__.txt with content 'hello'",
		);
		const results = findToolResults(messages);
		const writes = results.filter((r) => r.toolName === "Write");
		expect(writes.length, "Model must attempt Write tool").toBe(1);
		expect(writes[0].isError).toBe(true);
		expect(writes[0].resultContent).toMatch(/denied|Blocked/i);
	});

	it("allows benign WebFetch", (_ctx) => {
		const { messages } = runClaude(
			"Use the WebFetch tool to fetch https://www.google.com and return the page title",
		);
		const results = findToolResults(messages);
		const fetches = results.filter((r) => r.toolName === "WebFetch");

		expect(fetches.length, "Model must use WebFetch tool once").toBe(1);
		expect(fetches[0].isError).toBe(false);
	});
});
