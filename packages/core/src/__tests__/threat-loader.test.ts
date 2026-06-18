import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadThreats } from "../threat-loader.js";
import { makeTmpDir } from "./test-utils.js";

async function writeYaml(dir: string, filename: string, content: string): Promise<void> {
	await writeFile(join(dir, filename), content);
}

describe("loadThreats", () => {
	it("loads valid threats", async () => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"commands.yaml",
			`
- id: "CLT-CMD-001"
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
		expect(threats[0]?.severity).toBe("critical");
		expect(threats[0]?.flags).toEqual([]);
		expect(threats[0]?.compiledPattern).toBeInstanceOf(RegExp);
	});

	it("skips revoked threats", async () => {
		const dir = await makeTmpDir();
		await writeYaml(
			dir,
			"commands.yaml",
			`
- id: "CLT-CMD-REVOKED"
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
  category: testing
  severity: info
  confidence: 0.10
  pattern: "test_pattern"
  match_on: command
  title: "Flagged rule"
  flags: ["report"]
`,
		);
		const threats = await loadThreats(dir);
		expect(threats).toHaveLength(1);
		expect(threats[0]?.flags).toEqual(["report"]);
	});

	it("loads real threat files", async () => {
		const threatDir = join(import.meta.dirname, "../../../../threats");
		const threats = await loadThreats(threatDir);
		expect(threats.length).toBeGreaterThan(0);
		for (const t of threats) {
			expect(t.compiledPattern).toBeInstanceOf(RegExp);
		}
	});
});
