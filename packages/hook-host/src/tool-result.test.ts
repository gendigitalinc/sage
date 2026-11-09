/**
 * Tests for the shared tool_result handlers (output scan, approval note).
 * These cover the wiring only — detection itself is asserted in core's
 * evaluator tests.
 */

import type { Verdict } from "@gendigital/sage-core";
import { describe, expect, it, vi } from "vitest";
import type { ToolCallAdapter, ToolCallContext } from "./handler.js";
import { createOutputScanHandlers, outputHookInput, resultText } from "./tool-result.js";

const nullLogger = { debug() {}, info() {}, warn() {}, error() {} };
const branding = { name: "Sage", short_name: "Sage" };
const ctx: ToolCallContext = {
	hasUI: true,
	sessionManager: { getSessionId: () => "hook-host-handlers-session" },
};

/**
 * Names absent from this map emit no artifacts, which is how the handler
 * decides a tool is not scanned. `codemode` is deliberately absent.
 */
const adapter: ToolCallAdapter = {
	mapToolCall: (toolName, input) => {
		if (toolName === "bash") {
			return { toolName: "Bash", toolInput: input, artifacts: [{ type: "command", value: "x" }] };
		}
		if (toolName === "read" && typeof input.path === "string" && /^https?:/i.test(input.path)) {
			return {
				toolName: "WebFetch",
				toolInput: { url: input.path },
				artifacts: [{ type: "url", value: input.path }],
			};
		}
		if (toolName === "read") {
			return {
				toolName: "Read",
				toolInput: input,
				artifacts: [{ type: "file_path", value: String(input.path ?? "") }],
			};
		}
		return { toolName: "Unknown", toolInput: input, artifacts: [] };
	},
};

const handlers = () =>
	createOutputScanHandlers({
		logger: nullLogger,
		branding,
		agentRuntime: "pi",
		adapter,
		threatsDir: "/nonexistent/threats",
		trustedDomainsDir: "/nonexistent/trusted-domains",
	});

function askVerdict(artifact: string): Verdict {
	return {
		decision: "ask",
		category: "network_egress",
		confidence: 0.9,
		severity: "warning",
		source: "heuristic",
		artifacts: [artifact],
		matchedThreatId: "TEST-ASK-001",
		reasons: ["Test ask reason"],
	};
}

describe("shared tool_result handlers", () => {
	it("shapes tool output the way evaluateToolOutput reads it", () => {
		expect(outputHookInput("Read", "x")).toEqual({ tool_response: { content: "x" } });
		expect(outputHookInput("Bash", "x")).toEqual({ tool_response: { stdout: "x" } });
		expect(outputHookInput("WebFetch", "x")).toEqual({ tool_response: { result: "x" } });
		expect(outputHookInput("Grep", "x")).toBeUndefined();
		expect(outputHookInput("Read", "")).toBeUndefined();
		expect(
			resultText([{ type: "text", text: "a" }, { type: "image" }, { type: "text", text: "b" }]),
		).toBe("a\nb");
	});

	it("appends an approval note to the result of an approved call, once", async () => {
		const { onApproved, onToolResult } = handlers();
		const url = "https://example.test/page";
		onApproved(
			{ toolName: "bash", toolCallId: "call-approved", input: { command: `curl ${url}` } },
			askVerdict(url),
			[{ type: "url", value: url }],
			ctx,
		);

		// `codemode` is not in the tool map, so only the approval note is
		// appended and no output scan runs (keeps this test rule-independent).
		const event = {
			toolName: "codemode",
			toolCallId: "call-approved",
			input: {},
			content: [{ type: "text", text: "ok" }],
		};
		const patched = await onToolResult(event, ctx);
		const note = patched?.content.at(-1)?.text ?? "";
		expect(note).toContain("The user approved a flagged action");
		expect(note).toContain("TEST-ASK-001");
		expect(note).toContain(`URL '${url}'`);
		expect(note).toContain("~/.sage/exceptions.json");
		expect(patched?.content[0]).toEqual({ type: "text", text: "ok" });

		// The note is delivered once per approved call.
		expect(await onToolResult(event, ctx)).toBeUndefined();
	});

	it("scopes pending approvals by session so a reused call id cannot inherit one", async () => {
		const { onApproved, onToolResult } = handlers();
		const url = "https://example.test/scoped";
		onApproved(
			{ toolName: "bash", toolCallId: "call-shared", input: { command: `curl ${url}` } },
			askVerdict(url),
			[{ type: "url", value: url }],
			ctx,
		);

		const otherSession: ToolCallContext = {
			hasUI: true,
			sessionManager: { getSessionId: () => "a-different-session" },
		};
		const event = { toolName: "codemode", toolCallId: "call-shared", input: {}, content: [] };
		expect(await onToolResult(event, otherSession)).toBeUndefined();

		// Still waiting for its own session.
		const patched = await onToolResult(event, ctx);
		expect(patched?.content.at(-1)?.text).toContain("The user approved a flagged action");
	});

	it("drops an approval note that never receives a tool_result", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
		const { onApproved, onToolResult } = handlers();
		const url = "https://example.test/orphaned";
		onApproved(
			{ toolName: "bash", toolCallId: "call-orphaned", input: { command: `curl ${url}` } },
			askVerdict(url),
			[{ type: "url", value: url }],
			ctx,
		);

		// A crash or cancel never emits tool_result. After the TTL the note must
		// not still be waiting, or the map grows for the process lifetime.
		vi.setSystemTime(new Date("2026-01-01T02:00:00Z"));
		expect(
			await onToolResult(
				{ toolName: "codemode", toolCallId: "call-orphaned", input: {}, content: [] },
				ctx,
			),
		).toBeUndefined();
		vi.useRealTimers();
	});

	it("does not track approvals for free-form content artifacts", async () => {
		const { onApproved, onToolResult } = handlers();
		onApproved(
			{ toolName: "write", toolCallId: "call-content", input: {} },
			askVerdict("some content"),
			[{ type: "content", value: "some content" }],
			ctx,
		);
		expect(
			await onToolResult(
				{ toolName: "codemode", toolCallId: "call-content", input: {}, content: [] },
				ctx,
			),
		).toBeUndefined();
	});

	it("classifies an OMP URL read as WebFetch, not Read", async () => {
		const seen: string[] = [];
		const urlAdapter: ToolCallAdapter = {
			mapToolCall: (toolName, input, cwd) => {
				const mapped = adapter.mapToolCall(toolName, input, cwd);
				seen.push(mapped.toolName);
				return mapped;
			},
		};
		const { onToolResult } = createOutputScanHandlers({
			logger: nullLogger,
			branding,
			agentRuntime: "omp",
			adapter: urlAdapter,
			threatsDir: "/nonexistent/threats",
			trustedDomainsDir: "/nonexistent/trusted-domains",
		});
		// A static raw-name map labels every `read` as Read and skips the
		// WebFetch-only PI warning lookup. The adapter must be what decides.
		await onToolResult(
			{
				toolName: "read",
				toolCallId: "call-url-read",
				input: { path: "https://evil.example/data" },
				content: [{ type: "text", text: "fetched" }],
			},
			ctx,
		);
		await onToolResult(
			{
				toolName: "read",
				toolCallId: "call-local-read",
				input: { path: "/etc/passwd" },
				content: [{ type: "text", text: "root:x:0:0" }],
			},
			ctx,
		);
		expect(seen).toEqual(["WebFetch", "Read"]);
	});

	it("leaves results of tools it does not scan untouched", async () => {
		const { onToolResult } = handlers();
		expect(
			await onToolResult(
				{
					toolName: "codemode",
					toolCallId: "call-codemode",
					input: {},
					content: [{ type: "text", text: "anything" }],
				},
				ctx,
			),
		).toBeUndefined();
	});
});
