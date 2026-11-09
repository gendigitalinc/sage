import type {
	PluginFinding,
	PluginInfo,
	PluginScanResult,
	Verdict,
	VersionCheckResult,
} from "@gendigital/sage-core";
import {
	formatPiWarning,
	formatSessionStartMessage,
	formatStartupClean,
	formatThreatBanner,
	SESSION_START_FP_HINT,
	severityEmoji,
} from "@gendigital/sage-core";
import { describe, expect, it } from "vitest";
import { formatBlockReason } from "../format.js";

function makePlugin(key = "test-plugin@marketplace"): PluginInfo {
	return { key, installPath: "/tmp/test", version: "1.0.0", lastUpdated: "" };
}

function makeFinding(overrides: Partial<PluginFinding> = {}): PluginFinding {
	return {
		threatId: "CLT-CMD-001",
		title: "Pipe to shell",
		severity: "warning",
		artifact: "curl ... | bash",
		sourceFile: "setup.sh",
		...overrides,
	};
}

function makeVerdict(overrides: Partial<Verdict> = {}): Verdict {
	return {
		decision: "deny",
		category: "malware/bot, malware/backdoor",
		confidence: 1.0,
		severity: "critical",
		source: "url_check",
		artifacts: ["http://evil.com"],
		matchedThreatId: null,
		reasons: ["URL check: malicious"],
		...overrides,
	};
}

describe("severityEmoji", () => {
	it("returns alert emoji for critical", () => {
		expect(severityEmoji("critical")).toBe("🚨");
		expect(severityEmoji("CRITICAL")).toBe("🚨");
	});

	it("returns warning emoji for warning", () => {
		expect(severityEmoji("warning")).toBe("⚠️");
		expect(severityEmoji("WARNING")).toBe("⚠️");
	});

	it("returns info emoji for info/unknown", () => {
		expect(severityEmoji("info")).toBe("ℹ️");
		expect(severityEmoji("unknown")).toBe("ℹ️");
	});
});

describe("formatStartupClean", () => {
	it("includes version and clean status", () => {
		const msg = formatStartupClean("0.3.1");
		expect(msg).toContain("Sage v0.3.1");
		expect(msg).toContain("No threats found");
		expect(msg).toContain("🛡️");
		expect(msg).toContain("✅");
	});

	it("appends update notice when update is available", () => {
		const vc: VersionCheckResult = {
			currentVersion: "0.4.0",
			latestVersion: "0.5.0",
			updateAvailable: true,
		};
		const msg = formatStartupClean("0.4.0", vc);
		expect(msg).toContain("No threats found");
		expect(msg).toContain("Update available");
		expect(msg).toContain("v0.4.0");
		expect(msg).toContain("v0.5.0");
		expect(msg).toContain("github.com/gendigitalinc/sage");
	});

	it("does not append update notice when up to date", () => {
		const vc: VersionCheckResult = {
			currentVersion: "0.4.0",
			latestVersion: "0.4.0",
			updateAvailable: false,
		};
		const msg = formatStartupClean("0.4.0", vc);
		expect(msg).not.toContain("Update available");
	});

	it("does not append update notice when version check is null", () => {
		const msg = formatStartupClean("0.4.0", null);
		expect(msg).not.toContain("Update available");
	});

	it("does not include the false positive hint", () => {
		const vc: VersionCheckResult = {
			currentVersion: "0.4.0",
			latestVersion: "0.5.0",
			updateAvailable: true,
		};
		expect(formatStartupClean("0.4.0")).not.toContain(SESSION_START_FP_HINT);
		expect(formatStartupClean("0.4.0", vc)).not.toContain(SESSION_START_FP_HINT);
	});
});

describe("session-start false positive hint", () => {
	it("uses the same wording as the runtime FP hint", () => {
		expect(SESSION_START_FP_HINT).toBe(
			"If this is a false positive, ask your agent to report it with the sage_report_false_positive MCP tool.",
		);
	});

	it.each([
		[
			"skill",
			makeFinding({ threatId: "SKILL-CHECK", title: "Malicious skill", sourceFile: "SKILL.md" }),
		],
		[
			"URL",
			makeFinding({ threatId: "URL-CHECK", title: "Malicious URL", sourceFile: "URL check" }),
		],
		[
			"file",
			makeFinding({ threatId: "FILE-CHECK", title: "Malicious file", sourceFile: "bin/run.sh" }),
		],
	])("is shown for %s findings in verbose and compact styles", (_kind, finding) => {
		const result: PluginScanResult = { plugin: makePlugin(), findings: [finding] };
		expect(formatThreatBanner("0.3.1", [result])).toContain(SESSION_START_FP_HINT);
		expect(formatThreatBanner("0.3.1", [result], null, undefined, "compact")).toContain(
			SESSION_START_FP_HINT,
		);
	});

	it("appears once after all findings and before the update notice (verbose)", () => {
		const findings = Array.from({ length: 7 }, (_, i) =>
			makeFinding({ threatId: `CLT-${i}`, severity: "warning" }),
		);
		const results: PluginScanResult[] = [
			{ plugin: makePlugin("plugin-a@mp"), findings },
			{ plugin: makePlugin("plugin-b@mp"), findings: [makeFinding({ severity: "critical" })] },
		];
		const vc: VersionCheckResult = {
			currentVersion: "0.4.0",
			latestVersion: "0.5.0",
			updateAvailable: true,
		};
		const msg = formatThreatBanner("0.4.0", results, vc);
		expect(msg.split(SESSION_START_FP_HINT)).toHaveLength(2);
		expect(msg.indexOf(SESSION_START_FP_HINT)).toBeGreaterThan(msg.indexOf("plugin-b@mp"));
		expect(msg.indexOf(SESSION_START_FP_HINT)).toBeGreaterThan(msg.indexOf("... and 2 more"));
		expect(msg.indexOf(SESSION_START_FP_HINT)).toBeLessThan(msg.indexOf("Update available"));
	});

	it("is a single line after the findings tail in compact style", () => {
		const results: PluginScanResult[] = [
			{
				plugin: makePlugin(),
				findings: [makeFinding({ severity: "critical" }), makeFinding()],
			},
		];
		const lines = formatThreatBanner("0.3.1", results, null, undefined, "compact").split("\n");
		expect(lines).toContain(SESSION_START_FP_HINT);
		expect(lines.indexOf(SESSION_START_FP_HINT)).toBe(lines.indexOf("…and 1 more finding") + 1);
	});

	it("is omitted when only info findings exist", () => {
		const result: PluginScanResult = {
			plugin: makePlugin(),
			findings: [makeFinding({ severity: "info" })],
		};
		expect(formatThreatBanner("0.3.1", [result])).not.toContain(SESSION_START_FP_HINT);
		const compact = formatThreatBanner("0.3.1", [result], null, undefined, "compact");
		expect(compact).toContain("No threats found");
		expect(compact).not.toContain(SESSION_START_FP_HINT);
	});

	it("is omitted from the session-start message when no threats are found", () => {
		for (const style of ["verbose", "compact"] as const) {
			const msg = formatSessionStartMessage(
				"0.3.1",
				{ scanResults: [], versionCheck: null },
				undefined,
				style,
			);
			expect(msg).toContain("No threats found");
			expect(msg).not.toContain(SESSION_START_FP_HINT);
		}
	});

	it("prompt-injection warning uses the same FP wording", () => {
		const msg = formatPiWarning({ risk: 0.9, contentName: "https://example.com" });
		expect(msg).toContain(SESSION_START_FP_HINT);
	});
});

describe("formatThreatBanner", () => {
	it("renders single finding with structured layout", () => {
		const result: PluginScanResult = {
			plugin: makePlugin("cto-knowledge-base@cto-marketplace"),
			findings: [
				makeFinding({
					severity: "critical",
					threatId: "URL-CHECK",
					title: "Malicious URL (malware/misc)",
					sourceFile: "URL check",
				}),
			],
		};
		const msg = formatThreatBanner("0.3.1", [result]);
		expect(msg).toContain("🛡️ Sage v0.3.1 — Threat Detected");
		expect(msg).toContain("━");
		expect(msg).toContain("🚨");
		expect(msg).toContain("cto-knowledge-base@cto-marketplace");
		expect(msg).toContain("Malicious URL (malware/misc)");
		expect(msg).toContain("CRITICAL");
		expect(msg).toContain("URL check");
	});

	it("renders multiple findings with blank line separator", () => {
		const results: PluginScanResult[] = [
			{ plugin: makePlugin("plugin-a@mp"), findings: [makeFinding({ severity: "critical" })] },
			{ plugin: makePlugin("plugin-b@mp"), findings: [makeFinding({ severity: "warning" })] },
		];
		const msg = formatThreatBanner("0.3.1", results);
		expect(msg).toContain("plugin-a@mp");
		expect(msg).toContain("plugin-b@mp");
		// Blank line between groups
		expect(msg).toContain("\n\n");
	});

	it("skips info severity findings", () => {
		const result: PluginScanResult = {
			plugin: makePlugin(),
			findings: [makeFinding({ severity: "info" })],
		};
		const msg = formatThreatBanner("0.3.1", [result]);
		expect(msg).not.toContain("Plugin");
	});

	it("includes artifact when present", () => {
		const result: PluginScanResult = {
			plugin: makePlugin(),
			findings: [makeFinding({ severity: "critical", artifact: "http://evil.com/payload" })],
		};
		const msg = formatThreatBanner("0.3.1", [result]);
		expect(msg).toContain("Artifact");
		expect(msg).toContain("http://evil.com/payload");
	});

	it("omits artifact line when empty", () => {
		const result: PluginScanResult = {
			plugin: makePlugin(),
			findings: [makeFinding({ severity: "critical", artifact: "" })],
		};
		const msg = formatThreatBanner("0.3.1", [result]);
		expect(msg).not.toContain("Artifact");
	});

	it("caps findings at 5 per plugin", () => {
		const findings = Array.from({ length: 8 }, (_, i) =>
			makeFinding({ threatId: `CLT-${i}`, severity: "warning" }),
		);
		const result: PluginScanResult = { plugin: makePlugin(), findings };
		const msg = formatThreatBanner("0.3.1", [result]);
		expect(msg).toContain("... and 3 more");
	});

	it("appends update notice when update is available", () => {
		const result: PluginScanResult = {
			plugin: makePlugin(),
			findings: [makeFinding({ severity: "critical" })],
		};
		const vc: VersionCheckResult = {
			currentVersion: "0.4.0",
			latestVersion: "0.5.0",
			updateAvailable: true,
		};
		const msg = formatThreatBanner("0.4.0", [result], vc);
		expect(msg).toContain("Threat Detected");
		expect(msg).toContain("Update available");
		expect(msg).toContain("v0.5.0");
	});

	it("does not append update notice when up to date", () => {
		const result: PluginScanResult = {
			plugin: makePlugin(),
			findings: [makeFinding({ severity: "critical" })],
		};
		const vc: VersionCheckResult = {
			currentVersion: "0.4.0",
			latestVersion: "0.4.0",
			updateAvailable: false,
		};
		const msg = formatThreatBanner("0.4.0", [result], vc);
		expect(msg).not.toContain("Update available");
	});
});

describe("formatBlockReason", () => {
	it("renders deny verdict with structured details", () => {
		const msg = formatBlockReason(makeVerdict());
		expect(msg).toContain("🚨");
		expect(msg).toContain("URL check: malicious");
		expect(msg).toContain("Blocked");
		expect(msg).toContain("http://evil.com");
		expect(msg).toContain("Sage: Threat Blocked");
		expect(msg).toContain("━");
	});

	it("surfaces the threat rule id and names it in the FP hint", () => {
		const msg = formatBlockReason(
			makeVerdict({ source: "heuristic", matchedThreatId: "DUMMY-CMD-DENY-001" }),
		);
		expect(msg).toContain("Rule        DUMMY-CMD-DENY-001");
		expect(msg).toContain(
			"If this is a false positive, ask your agent to report it with the sage_report_false_positive MCP tool (rule DUMMY-CMD-DENY-001).",
		);
	});

	it("points user-exception blocks at the exceptions file instead of FP reporting", () => {
		const msg = formatBlockReason(
			makeVerdict({ source: "exception", matchedThreatId: "6e26ae6f" }),
		);
		expect(msg).toContain("Rule        6e26ae6f (your exception rule)");
		expect(msg).toContain("~/.sage/exceptions.json");
		expect(msg).not.toContain("sage_report_false_positive");
	});

	it("omits the Rule row when no rule backs the signal", () => {
		// URL check / AMSI / package check have no rule id to show.
		expect(formatBlockReason(makeVerdict())).not.toContain("Rule ");
	});

	it("renders ask verdict as Suspicious Activity with artifact", () => {
		const msg = formatBlockReason(
			makeVerdict({
				decision: "ask",
				severity: "warning",
				reasons: ["Overly permissive file permissions"],
				artifacts: ["/etc/shadow"],
			}),
		);
		expect(msg).toContain("Suspicious Activity Detected");
		expect(msg).toContain("⚠️");
		expect(msg).toContain("Requires confirmation");
		expect(msg).toContain("/etc/shadow");
		expect(msg).toContain("━");
	});

	it("falls back to category when no reasons", () => {
		const msg = formatBlockReason(makeVerdict({ reasons: [] }));
		expect(msg).toContain("malware/bot, malware/backdoor");
	});

	it("renders multiple artifacts", () => {
		const msg = formatBlockReason(
			makeVerdict({
				artifacts: ["http://evil.com", "http://also-evil.com"],
			}),
		);
		expect(msg).toContain("http://evil.com");
		expect(msg).toContain("http://also-evil.com");
	});
});
