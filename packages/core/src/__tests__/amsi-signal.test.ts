import { homedir } from "node:os";
import { describe, expect, it } from "vitest";
import { AMSI_CONTENT_NAME_MAX, AMSI_CONTENT_SNIPPET_MAX, buildAmsiSignal } from "../evaluator.js";
import type { AmsiCheckResult } from "../types.js";

function makeAmsiResult(overrides: Partial<AmsiCheckResult> = {}): AmsiCheckResult {
	return {
		content: "echo hello",
		contentName: "Bash:command",
		amsiResult: 0,
		isDetected: false,
		isBlockedByAdmin: false,
		...overrides,
	};
}

describe("buildAmsiSignal", () => {
	it("synthesizes 'AMSI|DETECTED' for amsi_result >= 0x8000", () => {
		const signal = buildAmsiSignal(
			makeAmsiResult({ amsiResult: 0x8000, isDetected: true, content: "x" }),
		);
		expect(signal.detection_name).toBe("AMSI|DETECTED");
		expect(signal.amsi_result).toBe(0x8000);
	});

	it("synthesizes 'AMSI|BLOCKED_BY_ADMIN' for 0x4000 <= amsi_result < 0x8000", () => {
		const signal = buildAmsiSignal(
			makeAmsiResult({ amsiResult: 0x4000, isBlockedByAdmin: true, content: "x" }),
		);
		expect(signal.detection_name).toBe("AMSI|BLOCKED_BY_ADMIN");
		expect(signal.amsi_result).toBe(0x4000);
	});

	it("uses defensive 'AMSI|UNKNOWN' label for non-detected/non-blocked results", () => {
		// Production callers in evaluator.ts filter to detected || blocked-by-admin first,
		// so this branch should never fire in normal flow — but the helper must still emit
		// a meaningful entry rather than silently corrupting the signal.
		const signal = buildAmsiSignal(makeAmsiResult({ amsiResult: 1, content: "x" }));
		expect(signal.detection_name).toBe("AMSI|UNKNOWN");
	});

	it("populates content_name and amsi_result for a detected result", () => {
		const signal = buildAmsiSignal(
			makeAmsiResult({
				amsiResult: 0x8000,
				isDetected: true,
				content: "Invoke-Mimikatz",
				contentName: "Bash:command",
			}),
		);
		expect(signal.content_name).toBe("Bash:command");
		expect(signal.amsi_result).toBe(0x8000);
		expect(signal.content_snippet).toBe("Invoke-Mimikatz");
	});

	it("omits content_snippet when content is empty", () => {
		const signal = buildAmsiSignal(
			makeAmsiResult({ amsiResult: 0x8000, isDetected: true, content: "" }),
		);
		expect("content_snippet" in signal).toBe(false);
	});

	it("caps content_snippet at AMSI_CONTENT_SNIPPET_MAX (200) chars", () => {
		const giant = "a".repeat(AMSI_CONTENT_SNIPPET_MAX + 50);
		const signal = buildAmsiSignal(
			makeAmsiResult({ amsiResult: 0x8000, isDetected: true, content: giant }),
		);
		expect(signal.content_snippet).toBeDefined();
		expect((signal.content_snippet ?? "").length).toBe(AMSI_CONTENT_SNIPPET_MAX);
	});

	it("caps content_name at AMSI_CONTENT_NAME_MAX (256) chars", () => {
		const giant = `Write:/tmp/${"x".repeat(AMSI_CONTENT_NAME_MAX + 50)}`;
		const signal = buildAmsiSignal(
			makeAmsiResult({
				amsiResult: 0x8000,
				isDetected: true,
				content: "x",
				contentName: giant,
			}),
		);
		expect(signal.content_name.length).toBe(AMSI_CONTENT_NAME_MAX);
	});

	it("scrubs the home directory from content_name when it embeds a file path", () => {
		const home = homedir();
		const signal = buildAmsiSignal(
			makeAmsiResult({
				amsiResult: 0x8000,
				isDetected: true,
				content: "x",
				contentName: `Write:${home}/secret/project/file.ts`,
			}),
		);
		// The scrubbed prefix may be `Write:~/secret/...` because the scrub helper only
		// rewrites the leading home prefix of the *whole* string. AMSI content_name uses
		// "Tool:path" form, so the path portion does not start at column 0 — verify the
		// result doesn't leak the literal home directory.
		expect(signal.content_name.includes(home)).toBe(false);
	});

	it("scrubs the home directory from content_snippet before truncation", () => {
		const home = homedir();
		const signal = buildAmsiSignal(
			makeAmsiResult({
				amsiResult: 0x8000,
				isDetected: true,
				content: `${home}/secret/payload.ps1; ${"a".repeat(AMSI_CONTENT_SNIPPET_MAX)}`,
				contentName: "Bash:command",
			}),
		);
		// Home is scrubbed first, then truncation happens — the result must not leak
		// the literal home string. Spent budget is on the actual command, not the prefix.
		expect((signal.content_snippet ?? "").includes(home)).toBe(false);
		expect((signal.content_snippet ?? "").length).toBeLessThanOrEqual(AMSI_CONTENT_SNIPPET_MAX);
	});
});
