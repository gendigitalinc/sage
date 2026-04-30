import { describe, expect, it } from "vitest";
import { CANONICAL_SET, type CanonicalToolType, canonicalizeToolName } from "../tool-names.js";

const SAMPLE_MAP: Record<string, CanonicalToolType> = {
	shell: "Bash",
	run_cmd: "Bash",
	fetch: "WebFetch",
	make_file: "Write",
};

describe("canonicalizeToolName", () => {
	it("returns canonical name when rawName is already canonical", () => {
		expect(canonicalizeToolName(SAMPLE_MAP, "Bash")).toBe("Bash");
		expect(canonicalizeToolName(SAMPLE_MAP, "Write")).toBe("Write");
		expect(canonicalizeToolName(SAMPLE_MAP, "Edit")).toBe("Edit");
		expect(canonicalizeToolName(SAMPLE_MAP, "WebFetch")).toBe("WebFetch");
		expect(canonicalizeToolName(SAMPLE_MAP, "Unknown")).toBe("Unknown");
	});

	it("maps known platform names via the provided map", () => {
		expect(canonicalizeToolName(SAMPLE_MAP, "shell")).toBe("Bash");
		expect(canonicalizeToolName(SAMPLE_MAP, "run_cmd")).toBe("Bash");
		expect(canonicalizeToolName(SAMPLE_MAP, "fetch")).toBe("WebFetch");
		expect(canonicalizeToolName(SAMPLE_MAP, "make_file")).toBe("Write");
	});

	it("returns Unknown for unmapped names", () => {
		expect(canonicalizeToolName(SAMPLE_MAP, "totally_new_tool")).toBe("Unknown");
		expect(canonicalizeToolName(SAMPLE_MAP, "")).toBe("Unknown");
	});

	it("works with an empty map", () => {
		expect(canonicalizeToolName({}, "Bash")).toBe("Bash");
		expect(canonicalizeToolName({}, "some_tool")).toBe("Unknown");
	});

	it("is case-sensitive", () => {
		expect(canonicalizeToolName(SAMPLE_MAP, "Shell")).toBe("Unknown");
		expect(canonicalizeToolName(SAMPLE_MAP, "BASH")).toBe("Unknown");
		expect(canonicalizeToolName(SAMPLE_MAP, "bash")).toBe("Unknown");
	});
});

describe("CANONICAL_SET", () => {
	it("contains all expected canonical tool types", () => {
		const expected = [
			"Bash",
			"WebFetch",
			"Write",
			"Edit",
			"Read",
			"Delete",
			"ApplyPatch",
			"Glob",
			"Grep",
			"List",
			"CodeSearch",
			"WebSearch",
			"Question",
			"Task",
			"ReadLines",
			"MCP",
			"Unknown",
		];
		for (const name of expected) {
			expect(CANONICAL_SET.has(name)).toBe(true);
		}
		expect(CANONICAL_SET.size).toBe(expected.length);
	});
});
