import { beforeAll, describe, expect, it } from "vitest";
import type { HeuristicsEngine } from "../heuristics.js";
import { createMatcher, loadEngine } from "./test-helper.js";

const matchContent = createMatcher("content");

// Tests for the four CVE-anchored privilege_escalation rules added in the ATR
// bridge (CLT-PRV-001a/b/d/e). Each rule has explicit match cases (must fire)
// and benign cases (must not fire). The three FP-prone rules from the original
// contribution (001c path-vocabulary, 002 eval(), 003 shell metacharacters)
// were dropped, so they are intentionally absent here.
describe("agent-layer privilege escalation threats (ATR, CVE-anchored)", () => {
	let engine: HeuristicsEngine;

	beforeAll(async () => {
		engine = await loadEngine();
	});

	// --- CLT-PRV-001a: file-write destination resolves to an autostart path ---

	it("detects a write destination pointing at /etc/cron.d (001a)", () => {
		const ids = matchContent(engine, 'output: "/etc/cron.d/backdoor"');
		expect(ids).toContain("CLT-PRV-001a");
	});

	it("detects a destination pointing at macOS LaunchAgents (001a)", () => {
		const ids = matchContent(engine, 'target: "~/Library/LaunchAgents/com.evil.plist"');
		expect(ids).toContain("CLT-PRV-001a");
	});

	it("does not match an ordinary build output path (001a FP)", () => {
		const ids = matchContent(engine, 'output: "./dist/bundle.js"');
		expect(ids).not.toContain("CLT-PRV-001a");
	});

	// --- CLT-PRV-001b: Semantic Kernel SessionsPythonPlugin identifiers ---

	it("detects the SessionsPythonPlugin identifier (001b)", () => {
		const ids = matchContent(engine, "This tool exposes SessionsPythonPlugin for code execution.");
		expect(ids).toContain("CLT-PRV-001b");
	});

	it("does not match ordinary session-management vocabulary (001b FP)", () => {
		const ids = matchContent(engine, "This plugin manages user login sessions and refresh tokens.");
		expect(ids).not.toContain("CLT-PRV-001b");
	});

	// --- CLT-PRV-001d: file-write CALL whose destination argument is autostart ---

	it("detects fs.writeFile into a systemd unit path (001d)", () => {
		const ids = matchContent(engine, 'fs.writeFile("/etc/systemd/system/evil.service", payload)');
		expect(ids).toContain("CLT-PRV-001d");
	});

	it("does not match fs.writeFile to an ordinary path (001d FP)", () => {
		const ids = matchContent(engine, 'fs.writeFile("./output.log", data)');
		expect(ids).not.toContain("CLT-PRV-001d");
	});

	// --- CLT-PRV-001e: Windows registry Run-key persistence ---

	it("detects reg add of an HKCU Run key (001e)", () => {
		const ids = matchContent(
			engine,
			"reg add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v Evil /d payload.exe",
		);
		expect(ids).toContain("CLT-PRV-001e");
	});

	it("does not match the English words register/regex (001e FP)", () => {
		const ids = matchContent(engine, "Please register the user, then compile the regex pattern.");
		expect(ids).not.toContain("CLT-PRV-001e");
	});
});
