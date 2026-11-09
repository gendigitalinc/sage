import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { expandMacros, loadThreats } from "../threat-loader.js";
import { type Logger, ThreatSchema } from "../types.js";
import { makeTmpDir } from "./test-utils.js";

async function writeYaml(dir: string, filename: string, content: string): Promise<void> {
	await writeFile(join(dir, filename), content);
}

function collectWarnings(): { logger: Logger; messages: string[] } {
	const messages: string[] = [];
	return {
		messages,
		logger: {
			debug() {},
			info() {},
			// Structured data carries the underlying cause (which macro, which
			// regex error), so tests can assert on it too.
			warn(msg, data) {
				messages.push(data ? `${msg} ${JSON.stringify(data)}` : msg);
			},
			error() {},
		},
	};
}

describe("loadThreats", () => {
	it("uses camelCase detectionName in the code-facing schema", () => {
		const threat = ThreatSchema.parse({
			id: "CLT-CMD-001",
			version: 1,
			detectionName: "CMD:SageCommand-A [Heur]",
			category: "tool",
			severity: "critical",
			confidence: 0.95,
			pattern: "curl",
			match_on: "command",
			title: "Schema naming",
		});

		expect(threat.detectionName).toBe("CMD:SageCommand-A [Heur]");
	});

	it("loads valid threats", async () => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"commands.yaml",
			`
- id: "CLT-CMD-001"
  version: 2
  detection_name: "CMD:SageCommand-A [Heur]"
  category: tool
  severity: critical
  confidence: 0.95
  pattern: "curl\\\\s.*\\\\|\\\\s*bash"
  match_on: command
  title: "Pipe to shell"
  expires_at: null
  revoked: false
`,
		);
		const threats = await loadThreats(dir);
		expect(threats).toHaveLength(1);
		expect(threats[0]?.id).toBe("CLT-CMD-001");
		expect(threats[0]?.version).toBe(2);
		expect(threats[0]?.detectionName).toBe("CMD:SageCommand-A [Heur]");
		expect(threats[0]?.severity).toBe("critical");
		expect(threats[0]?.flags).toEqual([]);
		expect(threats[0]?.compiledPattern).toBeInstanceOf(RegExp);
	});

	it.each([
		["missing", ""],
		["zero", "  version: 0\n"],
		["negative", "  version: -1\n"],
		["fractional", "  version: 1.5\n"],
		["non-numeric", '  version: "1"\n'],
	])("skips threats with a %s version", async (_case, versionLine) => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"commands.yaml",
			`
- id: "CLT-CMD-001"
${versionLine}  detection_name: "CMD:SageCommand-A [Heur]"
  category: tool
  severity: critical
  confidence: 0.95
  pattern: "curl"
  match_on: command
  title: "Version validation"
`,
		);

		expect(await loadThreats(dir)).toEqual([]);
	});

	it.each([
		["missing", ""],
		["empty", '  detection_name: ""\n'],
		["non-canonical", '  detection_name: "Sage command detection"\n'],
		["non-string", "  detection_name: 123\n"],
	])("skips threats with a %s detection name", async (_case, detectionNameLine) => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"commands.yaml",
			`
- id: "CLT-CMD-001"
  version: 1
${detectionNameLine}  category: tool
  severity: critical
  confidence: 0.95
  pattern: "curl"
  match_on: command
  title: "Detection-name validation"
`,
		);

		expect(await loadThreats(dir)).toEqual([]);
	});

	it("skips revoked threats", async () => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"commands.yaml",
			`
- id: "CLT-CMD-REVOKED"
  version: 1
  detection_name: "CMD:SageCommand-A [Heur]"
  category: tool
  severity: critical
  confidence: 0.95
  pattern: "bad_pattern"
  match_on: command
  title: "Revoked"
  expires_at: null
  revoked: true
`,
		);
		const threats = await loadThreats(dir);
		expect(threats).toHaveLength(0);
	});

	it("skips expired threats", async () => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"commands.yaml",
			`
- id: "CLT-CMD-EXPIRED"
  version: 1
  detection_name: "CMD:SageCommand-A [Heur]"
  category: tool
  severity: critical
  confidence: 0.95
  pattern: "expired_pattern"
  match_on: command
  title: "Expired"
  expires_at: "2020-01-01T00:00:00Z"
  revoked: false
`,
		);
		const threats = await loadThreats(dir);
		expect(threats).toHaveLength(0);
	});

	it("skips threats with missing fields", async () => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"commands.yaml",
			`
- id: "CLT-INCOMPLETE"
  category: tool
`,
		);
		const threats = await loadThreats(dir);
		expect(threats).toHaveLength(0);
	});

	it("skips bad regex", async () => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"commands.yaml",
			`
- id: "CLT-BAD-REGEX"
  version: 1
  detection_name: "CMD:SageBadRegex-A [Heur]"
  category: tool
  severity: critical
  confidence: 0.95
  pattern: "[invalid(regex"
  match_on: command
  title: "Bad regex"
  expires_at: null
  revoked: false
`,
		);
		const threats = await loadThreats(dir);
		expect(threats).toHaveLength(0);
	});

	it("returns empty for empty directory", async () => {
		const dir = await makeTmpDir();
		const threats = await loadThreats(dir);
		expect(threats).toEqual([]);
	});

	it("returns empty for nonexistent directory", async () => {
		const threats = await loadThreats("/nonexistent/dir");
		expect(threats).toEqual([]);
	});

	it("loads from multiple files", async () => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"commands.yaml",
			`
- id: "CLT-CMD-001"
  version: 1
  detection_name: "CMD:SageCommand-A [Heur]"
  category: tool
  severity: critical
  confidence: 0.95
  pattern: "curl.*bash"
  match_on: command
  title: "Pipe to shell"
`,
		);
		await writeYaml(
			dir,
			"urls.yaml",
			`
- id: "CLT-URL-001"
  version: 1
  detection_name: "FN:SageUrl-A [Heur]"
  category: network_egress
  severity: warning
  confidence: 0.85
  pattern: "pastebin.com/raw"
  match_on: url
  title: "Pastebin raw"
`,
		);
		const threats = await loadThreats(dir);
		expect(threats).toHaveLength(2);
		const ids = new Set(threats.map((t) => t.id));
		expect(ids.has("CLT-CMD-001")).toBe(true);
		expect(ids.has("CLT-URL-001")).toBe(true);
	});

	it("compiles case-insensitive regex when case_insensitive is true", async () => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"win-test.yaml",
			`
- id: "CLT-CI-001"
  version: 1
  detection_name: "CMD:SageCaseInsensitive-A [Heur]"
  category: tool
  severity: warning
  confidence: 0.90
  pattern: "\\\\binvoke-expression\\\\b"
  match_on: command
  title: "Case insensitive test"
  case_insensitive: true
  expires_at: null
  revoked: false
`,
		);
		const threats = await loadThreats(dir);
		expect(threats).toHaveLength(1);
		expect(threats[0]?.compiledPattern.flags).toContain("i");
		expect(threats[0]?.compiledPattern.test("Invoke-Expression")).toBe(true);
		expect(threats[0]?.compiledPattern.test("INVOKE-EXPRESSION")).toBe(true);
		expect(threats[0]?.compiledPattern.test("invoke-expression")).toBe(true);
	});

	it("does not set i flag when case_insensitive is absent", async () => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"test.yaml",
			`
- id: "CLT-CS-001"
  version: 1
  detection_name: "CMD:SageCaseSensitive-A [Heur]"
  category: tool
  severity: warning
  confidence: 0.90
  pattern: "curl.*bash"
  match_on: command
  title: "Case sensitive test"
  expires_at: null
  revoked: false
`,
		);
		const threats = await loadThreats(dir);
		expect(threats).toHaveLength(1);
		expect(threats[0]?.compiledPattern.flags).not.toContain("i");
		expect(threats[0]?.compiledPattern.test("curl | bash")).toBe(true);
		expect(threats[0]?.compiledPattern.test("CURL | BASH")).toBe(false);
	});

	it("parses flags field when present", async () => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"test.yaml",
			`
- id: "CLT-FLAG-001"
  version: 1
  detection_name: "CMD:SageFlag-A [Tst]"
  category: testing
  severity: info
  confidence: 0.10
  pattern: "test_pattern"
  match_on: command
  title: "Flagged rule"
  flags: ["submit_only"]
`,
		);
		const threats = await loadThreats(dir);
		expect(threats).toHaveLength(1);
		expect(threats[0]?.flags).toEqual(["submit_only"]);
	});

	it("loads real threat files", async () => {
		const threatDir = join(import.meta.dirname, "../../../../threats");
		const threats = await loadThreats(threatDir);
		expect(threats.length).toBeGreaterThan(0);
		for (const t of threats) {
			expect(t.version).toBeGreaterThan(0);
			expect(t.detectionName).toBeTruthy();
			expect(t.compiledPattern).toBeInstanceOf(RegExp);
			expect(t.pattern).not.toContain("{{");
		}
	});

	// --- Shared pattern vocabulary (`_*.yaml`) ---

	it("expands macro references and stores the expanded pattern", async () => {
		const dir = await makeTmpDir();
		await writeYaml(dir, "_macros.yaml", 'BOUNDARY: "(?:^|;)"\n');
		await writeYaml(
			dir,
			"test.yaml",
			`
- id: "CLT-MACRO-001"
  version: 1
  detection_name: "CMD:SageMacro-A [Tst]"
  category: testing
  severity: info
  confidence: 0.10
  pattern: "{{BOUNDARY}}danger"
  match_on: command
  title: "Macro rule"
`,
		);
		const threats = await loadThreats(dir);
		expect(threats).toHaveLength(1);
		expect(threats[0]?.pattern).toBe("(?:^|;)danger");
		expect(threats[0]?.compiledPattern.test("ls; danger")).toBe(false);
		expect(threats[0]?.compiledPattern.test("ls;danger")).toBe(true);
	});

	it("resolves macros that reference other macros", async () => {
		const dir = await makeTmpDir();
		await writeYaml(dir, "_macros.yaml", 'INNER: "a|b"\nOUTER: "(?:{{INNER}})+"\n');
		await writeYaml(
			dir,
			"test.yaml",
			`
- id: "CLT-MACRO-002"
  version: 1
  detection_name: "CMD:SageMacro-A [Tst]"
  category: testing
  severity: info
  confidence: 0.10
  pattern: "{{OUTER}}z"
  match_on: command
  title: "Nested macro rule"
`,
		);
		const threats = await loadThreats(dir);
		expect(threats[0]?.pattern).toBe("(?:a|b)+z");
	});

	it("does not parse macro files as rule lists", async () => {
		const dir = await makeTmpDir();
		await writeYaml(dir, "_macros.yaml", 'BOUNDARY: "(?:^|;)"\n');
		const threats = await loadThreats(dir);
		expect(threats).toHaveLength(0);
	});

	// Only `_macros.yaml` is reserved. Any other underscore-prefixed file is a
	// rule file — a pack using that convention for ordering must keep loading.
	it("loads an underscore-prefixed file that holds a rule list", async () => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"_ordered.yaml",
			`
- id: "CLT-ORDER-001"
  version: 1
  detection_name: "CMD:SageOrdered-A [Tst]"
  category: testing
  severity: info
  confidence: 0.10
  pattern: "danger"
  match_on: command
  title: "Rule in an underscore-prefixed file"
`,
		);
		const threats = await loadThreats(dir);
		expect(threats).toHaveLength(1);
		expect(threats[0]?.id).toBe("CLT-ORDER-001");
	});

	// Only the reserved filename may be a mapping. Anywhere else a mapping is a
	// rule file missing its list, and must be reported rather than accepted.
	it("reports a mapping in a rule file", async () => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"oops.yaml",
			`
id: "CLT-OOPS-001"
category: testing
severity: info
confidence: 0.10
pattern: "danger"
match_on: command
title: "Rule that forgot its list"
`,
		);
		const warnings = collectWarnings();
		const threats = await loadThreats(dir, warnings.logger);
		expect(threats).toHaveLength(0);
		expect(warnings.messages.join("\n")).toContain("Expected list in oops.yaml");
	});

	it("reports a rule list in the reserved vocabulary filename", async () => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"_macros.yaml",
			`
- id: "CLT-WRONG-001"
  category: testing
  severity: info
  confidence: 0.10
  pattern: "danger"
  match_on: command
  title: "Rules in the vocabulary file"
`,
		);
		const warnings = collectWarnings();
		const threats = await loadThreats(dir, warnings.logger);
		expect(threats).toHaveLength(0);
		expect(warnings.messages.join("\n")).toContain("Expected mapping in _macros.yaml, got list");
	});

	it("reports a syntax error as a parse failure, not a read failure", async () => {
		const dir = await makeTmpDir();
		await writeYaml(dir, "broken.yaml", "- id: 'unclosed\n  category: [oops\n");
		const warnings = collectWarnings();
		const threats = await loadThreats(dir, warnings.logger);
		expect(threats).toHaveLength(0);
		const joined = warnings.messages.join("\n");
		expect(joined).toContain("Failed to parse broken.yaml");
		expect(joined).not.toContain("Failed to read");
	});

	// A mapping outside the reserved filename is not vocabulary, so a rule
	// depending on it is skipped rather than compiled against a stale pattern.
	it("does not read vocabulary from any other filename", async () => {
		const dir = await makeTmpDir();
		await writeYaml(dir, "vocabulary.yaml", 'BOUNDARY: "(?:^|;)"\n');
		await writeYaml(
			dir,
			"test.yaml",
			`
- id: "CLT-MACRO-005"
  version: 1
  detection_name: "CMD:SageMacro-A [Tst]"
  category: testing
  severity: info
  confidence: 0.10
  pattern: "{{BOUNDARY}}danger"
  match_on: command
  title: "Macro rule"
`,
		);
		const warnings = collectWarnings();
		const threats = await loadThreats(dir, warnings.logger);
		expect(threats).toHaveLength(0);
		const joined = warnings.messages.join("\n");
		expect(joined).toContain("Expected list in vocabulary.yaml");
		expect(joined).toContain("undefined macro {{BOUNDARY}}");
	});

	it("skips a rule referencing an undefined macro", async () => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"test.yaml",
			`
- id: "CLT-MACRO-003"
  version: 1
  detection_name: "CMD:SageMacro-A [Tst]"
  category: testing
  severity: info
  confidence: 0.10
  pattern: "{{NOPE}}danger"
  match_on: command
  title: "Dangling macro rule"
`,
		);
		const threats = await loadThreats(dir);
		expect(threats).toHaveLength(0);
	});

	it("skips a rule whose macros nest too deeply", async () => {
		const dir = await makeTmpDir();
		await writeYaml(dir, "_macros.yaml", 'LOOP: "x{{LOOP}}"\n');
		await writeYaml(
			dir,
			"test.yaml",
			`
- id: "CLT-MACRO-004"
  version: 1
  detection_name: "CMD:SageMacro-A [Tst]"
  category: testing
  severity: info
  confidence: 0.10
  pattern: "{{LOOP}}"
  match_on: command
  title: "Recursive macro rule"
`,
		);
		const threats = await loadThreats(dir);
		expect(threats).toHaveLength(0);
	});
});

describe("expandMacros", () => {
	it("leaves a pattern without references untouched", () => {
		expect(expandMacros("plain\\spattern", {})).toBe("plain\\spattern");
	});

	it("expands every occurrence of a reference", () => {
		expect(expandMacros("{{A}}-{{A}}", { A: "x" })).toBe("x-x");
	});

	it("throws on an undefined reference", () => {
		expect(() => expandMacros("{{MISSING}}", {})).toThrow("undefined macro {{MISSING}}");
	});

	it("throws instead of looping on a self-referencing macro", () => {
		expect(() => expandMacros("{{SELF}}", { SELF: "{{SELF}}" })).toThrow("macro nesting");
	});
});
