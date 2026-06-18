/**
 * Contract tests for the MCP hook configuration in hooks/hooks.json.
 *
 * Unlike command hooks (which received the whole hook event on stdin), mcp_tool
 * hooks only receive the fields enumerated in the `input` template map. These
 * tests pin that contract:
 *
 * 1. Template coverage — each hook's `input` keys must cover the full common
 *    hook payload, so core sees the same data Claude Code sends to command
 *    hooks on other platforms.
 * 2. Round-trip parity — a hook event pushed through simulated Claude template
 *    substitution and `normalizeClaudeHookInput` must reproduce the original
 *    payload exactly.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeClaudeHookInput } from "../mcp-hook-tools.js";

const HOOKS_JSON_PATH = resolve(__dirname, "..", "..", "..", "..", "hooks", "hooks.json");

interface McpToolHook {
	type: string;
	server: string;
	tool: string;
	input: Record<string, string>;
}

function loadMcpToolHook(event: "PreToolUse" | "PostToolUse"): McpToolHook {
	const hooksJson = JSON.parse(readFileSync(HOOKS_JSON_PATH, "utf-8")) as {
		hooks: Record<string, Array<{ hooks: McpToolHook[] }>>;
	};
	const matchers = hooksJson.hooks[event];
	expect(matchers, `${event} must have exactly one matcher group`).toHaveLength(1);
	const hooks = matchers?.[0]?.hooks ?? [];
	expect(hooks, `${event} must have exactly one hook`).toHaveLength(1);
	const hook = hooks[0] as McpToolHook;
	expect(hook.type).toBe("mcp_tool");
	expect(hook.server).toBe("plugin:sage:sage");
	return hook;
}

/**
 * Fields common to every Claude Code hook event, plus the PreToolUse tool
 * payload. If core starts consuming a new hook field, it must be added both
 * here and to the hooks.json templates (and to HookInputSchema /
 * TOP_LEVEL_KEYS in mcp-hook-tools.ts).
 */
const COMMON_INPUT_FIELDS = [
	"session_id",
	"transcript_path",
	"cwd",
	"permission_mode",
	"hook_event_name",
	"tool_name",
	"tool_use_id",
	"tool_input",
];

/**
 * Simulates Claude Code's `${field}` substitution in mcp_tool hook input
 * templates: object values are serialized to JSON strings, scalars become
 * plain strings.
 */
function simulateTemplating(
	hook: McpToolHook,
	payload: Record<string, unknown>,
): Record<string, unknown> {
	const args: Record<string, unknown> = {};
	for (const [key, template] of Object.entries(hook.input)) {
		const field = template.slice(2, -1);
		const value = payload[field];
		if (value === undefined) continue;
		args[key] = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
	}
	return args;
}

describe("hooks.json MCP hook template coverage", () => {
	it("PreToolUse passes the full common hook payload", () => {
		const hook = loadMcpToolHook("PreToolUse");
		expect(hook.tool).toBe("sage_claude_pre_tool_use");
		expect(Object.keys(hook.input).sort()).toEqual([...COMMON_INPUT_FIELDS].sort());
	});

	it("PostToolUse passes the full common hook payload plus tool output fields", () => {
		const hook = loadMcpToolHook("PostToolUse");
		expect(hook.tool).toBe("sage_claude_post_tool_use");
		expect(Object.keys(hook.input).sort()).toEqual(
			[...COMMON_INPUT_FIELDS, "tool_response", "duration_ms"].sort(),
		);
	});
});

describe("hooks.json round-trip parity with command-hook stdin", () => {
	it("decodes structural hook-template fields without parsing leaf text", () => {
		const content = JSON.stringify({ config: true });
		const stdout = JSON.stringify({ ok: true });

		const normalized = normalizeClaudeHookInput({
			duration_ms: "42",
			tool_input: JSON.stringify({
				command: "echo hello",
				offset: "7",
				content,
			}),
			tool_response: JSON.stringify({
				stdout,
				success: true,
			}),
		});

		expect(normalized.duration_ms).toBe(42);
		expect(normalized.tool_input).toMatchObject({
			command: "echo hello",
			offset: 7,
			content,
		});
		expect(normalized.tool_response).toMatchObject({
			stdout,
			success: true,
		});
	});

	it("PreToolUse: templated args normalize back to the original hook event", () => {
		const hook = loadMcpToolHook("PreToolUse");
		const event = {
			session_id: "sess-parity-1",
			transcript_path: "/tmp/transcripts/sess-parity-1.jsonl",
			cwd: "/repo/project",
			permission_mode: "default",
			hook_event_name: "PreToolUse",
			tool_name: "Bash",
			tool_use_id: "toolu_parity_pre",
			tool_input: {
				command: "echo hello",
				description: "Print a greeting",
				timeout: 5000,
			},
		};

		const normalized = normalizeClaudeHookInput(simulateTemplating(hook, event));

		expect(normalized).toEqual(event);
	});

	it("PostToolUse: templated args normalize back to the original hook event", () => {
		const hook = loadMcpToolHook("PostToolUse");
		const event = {
			session_id: "sess-parity-2",
			transcript_path: "/tmp/transcripts/sess-parity-2.jsonl",
			cwd: "/repo/project",
			permission_mode: "acceptEdits",
			hook_event_name: "PostToolUse",
			tool_name: "Read",
			tool_use_id: "toolu_parity_post",
			tool_input: {
				file_path: "/repo/project/README.md",
				offset: 1,
				limit: 100,
			},
			tool_response: {
				content: "# Project\n\nSome readme content.",
				truncated: false,
			},
			duration_ms: 123,
		};

		const normalized = normalizeClaudeHookInput(simulateTemplating(hook, event));

		expect(normalized).toEqual(event);
	});

	it("PostToolUse: a plain-string tool_response is preserved as tool_output for content scanning", () => {
		const hook = loadMcpToolHook("PostToolUse");
		const event = {
			session_id: "sess-parity-3",
			transcript_path: "/tmp/transcripts/sess-parity-3.jsonl",
			cwd: "/repo/project",
			permission_mode: "default",
			hook_event_name: "PostToolUse",
			tool_name: "WebFetch",
			tool_use_id: "toolu_parity_raw",
			tool_input: { url: "https://example.com" },
			tool_response: "raw page text that is not JSON",
			duration_ms: 45,
		};

		const normalized = normalizeClaudeHookInput(simulateTemplating(hook, event));

		const { tool_response, ...rest } = event;
		expect(normalized).toEqual({ ...rest, tool_output: tool_response });
	});
});
