import { describe, expect, it } from "vitest";
import { DecisionEngine } from "../engine.js";
import type {
	AmsiCheckResult,
	Decision,
	PackageCheckResult,
	PiCheckResult,
	UrlCheckResult,
} from "../types.js";

const SENSITIVITIES = ["paranoid", "balanced", "relaxed"] as const;

describe("Signal source × sensitivity matrix", () => {
	describe("URL check", () => {
		it.each(SENSITIVITIES)("%s: malicious → deny", async (sensitivity) => {
			const engine = new DecisionEngine(sensitivity);
			const url: UrlCheckResult = {
				url: "http://untrusted.test",
				isMalicious: true,
				detections: [],
				findings: [{ severityName: "malware", typeName: "trojan" }],
			};
			const verdict = await engine.decide({
				heuristicMatches: [],
				urlCheckResults: [url],
			});
			expect(verdict.decision).toBe("deny");
			expect(verdict.confidence).toBe(1.0);
			expect(verdict.severity).toBe("critical");
		});

		it.each(SENSITIVITIES)("%s: clean → allow", async (sensitivity) => {
			const engine = new DecisionEngine(sensitivity);
			const url: UrlCheckResult = {
				url: "http://safe.test",
				isMalicious: false,
				detections: [],
				findings: [],
			};
			const verdict = await engine.decide({
				heuristicMatches: [],
				urlCheckResults: [url],
			});
			expect(verdict.decision).toBe("allow");
		});
	});

	describe("Package check", () => {
		const cases: Array<{
			verdict: string;
			confidence: number;
			expected: Record<string, Decision>;
		}> = [
			{
				verdict: "not_found",
				confidence: 0.95,
				expected: { paranoid: "deny", balanced: "deny", relaxed: "deny" },
			},
			{
				verdict: "malicious",
				confidence: 1.0,
				expected: { paranoid: "deny", balanced: "deny", relaxed: "deny" },
			},
			{
				verdict: "suspicious_age",
				confidence: 0.6,
				expected: { paranoid: "ask", balanced: "ask", relaxed: "allow" },
			},
			{
				verdict: "unknown",
				confidence: 0.6,
				expected: { paranoid: "ask", balanced: "ask", relaxed: "allow" },
			},
		];

		for (const { verdict: pkgVerdict, confidence, expected } of cases) {
			it.each(
				SENSITIVITIES,
			)(`%s: ${pkgVerdict} (conf=${confidence}) → expected`, async (sensitivity) => {
				const engine = new DecisionEngine(sensitivity);
				const pkg: PackageCheckResult = {
					packageName: "test-pkg",
					registry: "npm",
					verdict: pkgVerdict as PackageCheckResult["verdict"],
					confidence,
					details: "test",
				};
				const result = await engine.decide({
					heuristicMatches: [],
					urlCheckResults: [],
					packageCheckResults: [pkg],
				});
				expect(result.decision).toBe(expected[sensitivity]);
			});
		}

		it.each(SENSITIVITIES)("%s: clean → allow", async (sensitivity) => {
			const engine = new DecisionEngine(sensitivity);
			const pkg: PackageCheckResult = {
				packageName: "express",
				registry: "npm",
				verdict: "clean",
				confidence: 1.0,
				details: "verified",
			};
			const result = await engine.decide({
				heuristicMatches: [],
				urlCheckResults: [],
				packageCheckResults: [pkg],
			});
			expect(result.decision).toBe("allow");
		});
	});

	describe("AMSI check", () => {
		it.each(SENSITIVITIES)("%s: detected → deny", async (sensitivity) => {
			const engine = new DecisionEngine(sensitivity);
			const amsi: AmsiCheckResult = {
				content: "test content",
				contentName: "Bash:command",
				amsiResult: 32768,
				isDetected: true,
				isBlockedByAdmin: false,
			};
			const verdict = await engine.decide({
				heuristicMatches: [],
				urlCheckResults: [],
				amsiCheckResults: [amsi],
			});
			expect(verdict.decision).toBe("deny");
			expect(verdict.confidence).toBe(1.0);
		});

		const adminBlockedExpected: Record<string, Decision> = {
			paranoid: "deny",
			balanced: "deny",
			relaxed: "ask",
		};

		it.each(SENSITIVITIES)("%s: admin-blocked (conf=0.9) → expected", async (sensitivity) => {
			const engine = new DecisionEngine(sensitivity);
			const amsi: AmsiCheckResult = {
				content: "blocked content",
				contentName: "Write:/tmp/test.ps1",
				amsiResult: 16384,
				isDetected: false,
				isBlockedByAdmin: true,
			};
			const verdict = await engine.decide({
				heuristicMatches: [],
				urlCheckResults: [],
				amsiCheckResults: [amsi],
			});
			expect(verdict.decision).toBe(adminBlockedExpected[sensitivity]);
		});

		it.each(SENSITIVITIES)("%s: clean → allow", async (sensitivity) => {
			const engine = new DecisionEngine(sensitivity);
			const amsi: AmsiCheckResult = {
				content: "echo hello",
				contentName: "Bash:command",
				amsiResult: 0,
				isDetected: false,
				isBlockedByAdmin: false,
			};
			const verdict = await engine.decide({
				heuristicMatches: [],
				urlCheckResults: [],
				amsiCheckResults: [amsi],
			});
			expect(verdict.decision).toBe("allow");
		});
	});

	describe("PI check", () => {
		it.each(
			SENSITIVITIES,
		)("%s: high-risk (0.995) → deny (bypasses demotion)", async (sensitivity) => {
			const engine = new DecisionEngine(sensitivity);
			const pi: PiCheckResult = {
				contentName: "WebFetch:https://example.test/",
				risk: 0.995,
				findings: ["high risk content detected"],
				modelId: "test-model",
			};
			const verdict = await engine.decide({
				heuristicMatches: [],
				urlCheckResults: [],
				piCheckResults: [pi],
			});
			expect(verdict.decision).toBe("deny");
			expect(verdict.source).toBe("pi_check");
		});

		const mediumRiskExpected: Record<string, Decision> = {
			paranoid: "ask",
			balanced: "ask",
			relaxed: "allow",
		};

		it.each(SENSITIVITIES)("%s: medium-risk (0.6) → expected", async (sensitivity) => {
			const engine = new DecisionEngine(sensitivity);
			const pi: PiCheckResult = {
				contentName: "WebFetch:https://example.test/",
				risk: 0.6,
				findings: ["suspicious content"],
				modelId: "test-model",
			};
			const verdict = await engine.decide({
				heuristicMatches: [],
				urlCheckResults: [],
				piCheckResults: [pi],
			});
			expect(verdict.decision).toBe(mediumRiskExpected[sensitivity]);
		});

		it.each(SENSITIVITIES)("%s: below-medium (0.3) → allow", async (sensitivity) => {
			const engine = new DecisionEngine(sensitivity);
			const pi: PiCheckResult = {
				contentName: "WebFetch:https://example.test/",
				risk: 0.3,
				findings: [],
				modelId: "test-model",
			};
			const verdict = await engine.decide({
				heuristicMatches: [],
				urlCheckResults: [],
				piCheckResults: [pi],
			});
			expect(verdict.decision).toBe("allow");
		});
	});
});
