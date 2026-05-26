import { describe, expect, it, vi } from "vitest";
import { ApprovalStore } from "../approval-store.js";
import { approveAction, formatDenyMessage, guardToolCall, summarizeArtifacts } from "../guard.js";
import type { Verdict } from "../types.js";

// Mock evaluator
vi.mock("../evaluator.js", async (importOriginal) => {
	const original = (await importOriginal()) as Record<string, unknown>;
	return {
		...original,
		evaluateToolCall: vi.fn(),
	};
});

// Mock config
vi.mock("../config.js", async (importOriginal) => {
	const original = (await importOriginal()) as Record<string, unknown>;
	return {
		...original,
		loadConfig: vi.fn(),
	};
});

const { evaluateToolCall } = await import("../evaluator.js");
const { loadConfig } = await import("../config.js");

const mockEvaluate = vi.mocked(evaluateToolCall);
const mockLoadConfig = vi.mocked(loadConfig);

function makeRequest(toolName = "bash", toolInput: Record<string, unknown> = { command: "ls" }) {
	return {
		sessionId: "s1",
		toolName,
		toolInput,
		artifacts: [{ type: "command" as const, value: "ls" }],
	};
}

function makeContext() {
	return { threatsDir: "/threats", allowlistsDir: "/allowlists" };
}

function makeVerdict(overrides: Partial<Verdict> = {}): Verdict {
	return {
		decision: "allow",
		category: "test",
		confidence: 0.9,
		severity: "info",
		source: "test",
		artifacts: [],
		matchedThreatId: null,
		reasons: ["test reason"],
		...overrides,
	};
}

describe("guardToolCall", () => {
	it("returns allow when action is already approved", async () => {
		const store = new ApprovalStore();
		const request = makeRequest();
		const actionId = ApprovalStore.actionId(request.toolName, request.toolInput, request.sessionId);

		// Pre-approve the action
		store.setPending(actionId, { artifacts: request.artifacts, createdAt: Date.now() });
		store.approve(actionId);

		const { verdict } = await guardToolCall(request, makeContext(), store);
		expect(verdict.decision).toBe("allow");
		expect(verdict.source).toBe("approved");
	});

	it("delegates to evaluateToolCall and returns allow verdict", async () => {
		const store = new ApprovalStore();
		mockEvaluate.mockResolvedValueOnce(makeVerdict({ decision: "allow" }));

		const { verdict } = await guardToolCall(makeRequest(), makeContext(), store);
		expect(verdict.decision).toBe("allow");
		expect(mockEvaluate).toHaveBeenCalled();
	});

	it("returns deny verdict from evaluateToolCall", async () => {
		const store = new ApprovalStore();
		mockEvaluate.mockResolvedValueOnce(makeVerdict({ decision: "deny" }));

		const { verdict } = await guardToolCall(makeRequest(), makeContext(), store);
		expect(verdict.decision).toBe("deny");
	});

	it("promotes ask to deny in paranoid mode", async () => {
		const store = new ApprovalStore();
		mockEvaluate.mockResolvedValueOnce(makeVerdict({ decision: "ask" }));
		mockLoadConfig.mockResolvedValueOnce({ sensitivity: "paranoid" } as ReturnType<
			typeof loadConfig
		> extends Promise<infer T>
			? T
			: never);

		const { verdict } = await guardToolCall(makeRequest(), makeContext(), store);
		expect(verdict.decision).toBe("deny");
	});

	it("does not setPending when paranoid promotes ask to deny", async () => {
		const store = new ApprovalStore();
		const request = makeRequest();
		const actionId = ApprovalStore.actionId(request.toolName, request.toolInput, request.sessionId);

		mockEvaluate.mockResolvedValueOnce(makeVerdict({ decision: "ask" }));
		mockLoadConfig.mockResolvedValueOnce({ sensitivity: "paranoid" } as ReturnType<
			typeof loadConfig
		> extends Promise<infer T>
			? T
			: never);

		await guardToolCall(request, makeContext(), store);
		// Should not have a pending entry
		expect(store.approve(actionId)).toBeNull();
	});

	it("sets pending for ask verdict in non-paranoid mode", async () => {
		const store = new ApprovalStore();
		const request = makeRequest();
		const actionId = ApprovalStore.actionId(request.toolName, request.toolInput, request.sessionId);

		mockEvaluate.mockResolvedValueOnce(makeVerdict({ decision: "ask" }));
		mockLoadConfig.mockResolvedValueOnce({ sensitivity: "balanced" } as ReturnType<
			typeof loadConfig
		> extends Promise<infer T>
			? T
			: never);

		const { verdict, actionId: returnedActionId } = await guardToolCall(
			request,
			makeContext(),
			store,
		);
		expect(verdict.decision).toBe("ask");
		expect(returnedActionId).toBe(actionId);

		// Should have a pending entry
		const entry = store.approve(actionId);
		expect(entry).not.toBeNull();
	});
});

describe("formatDenyMessage", () => {
	it("formats deny message with reasons", () => {
		const msg = formatDenyMessage(makeVerdict({ decision: "deny", reasons: ["bad stuff"] }));
		expect(msg).toContain("Sage blocked this action.");
		expect(msg).toContain("bad stuff");
	});

	it("falls back to category when no reasons", () => {
		const msg = formatDenyMessage(
			makeVerdict({ decision: "deny", reasons: [], category: "exfil" }),
		);
		expect(msg).toContain("exfil");
	});
});

describe("summarizeArtifacts", () => {
	it("formats artifacts", () => {
		expect(
			summarizeArtifacts([
				{ type: "url", value: "https://x.com" },
				{ type: "command", value: "ls" },
			]),
		).toBe("url 'https://x.com', command 'ls'");
	});

	it("returns none for empty", () => {
		expect(summarizeArtifacts([])).toBe("none");
	});

	it("truncates at 3 artifacts", () => {
		const arts = Array.from({ length: 5 }, (_, i) => ({
			type: "url" as const,
			value: `http://${i}`,
		}));
		const result = summarizeArtifacts(arts);
		expect(result.split(", ")).toHaveLength(3);
	});

	it("truncates long artifact values", () => {
		const longValue = "x".repeat(200);
		const result = summarizeArtifacts([{ type: "command", value: longValue }]);
		expect(result.length).toBeLessThan(200);
		expect(result).toContain("…");
	});

	it("replaces newlines with escaped \\n in artifact values", () => {
		const result = summarizeArtifacts([{ type: "command", value: "line1\nline2\nline3" }]);
		expect(result).not.toContain("\n");
		expect(result).toContain("line1\\nline2\\nline3");
	});
});

describe("approveAction", () => {
	it("approves pending action and returns original tool call", async () => {
		const store = new ApprovalStore();
		store.setPending("a1", {
			artifacts: [{ type: "command", value: "chmod 777 ./x" }],
			createdAt: Date.now(),
		});

		const msg = await approveAction(store, "a1");
		expect(msg).toContain("Approved");
		expect(msg).toContain("command 'chmod 777 ./x'");
		expect(msg).toContain("do not modify the arguments");
		expect(store.isApproved("a1")).toBe(true);
	});

	it("returns error for unknown actionId", async () => {
		const store = new ApprovalStore();
		const msg = await approveAction(store, "nonexistent");
		expect(msg).toContain("No pending Sage approval");
	});
});
