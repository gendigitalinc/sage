/**
 * Decision engine — combines signals into a final Verdict.
 */

import type {
	AmsiCheckResult,
	Decision,
	HeuristicMatch,
	PackageCheckResult,
	PiCheckResult,
	SignalSources,
	UrlCheckResult,
	Verdict,
	VerdictSeverity,
} from "./types.js";
import { DEFAULT_PI_HIGH_RISK_THRESHOLD, DEFAULT_PI_MEDIUM_RISK_THRESHOLD } from "./types.js";

/** Default confidence threshold. */
export const CONFIDENCE_THRESHOLD = 0.85;

/** Sensitivity presets: maps preset name to confidence threshold. */
const SENSITIVITY_THRESHOLDS: Record<string, number> = {
	paranoid: 0.7,
	balanced: 0.85,
	relaxed: 0.95,
};

/** Severity mapping: 4-level threat def → 3-level user-facing verdict. */
const SEVERITY_MAP: Record<string, VerdictSeverity> = {
	critical: "critical",
	high: "warning",
	medium: "warning",
	low: "info",
};

/** Action mapping: threat def action → verdict decision. */
const ACTION_MAP: Record<string, Decision> = {
	block: "deny",
	require_approval: "ask",
	log: "allow",
};

/** Decision priority for merge precedence: deny > ask > allow. */
const DECISION_PRIORITY: Record<string, number> = {
	allow: 0,
	ask: 1,
	deny: 2,
};

interface Signal {
	decision: Decision;
	category: string;
	confidence: number;
	severity: VerdictSeverity;
	source: string;
	threatId: string | null;
	reason: string;
	artifact: string;
}

const PI_LABEL_ONLY_SUFFIXES: ReadonlySet<string> = new Set([
	"command",
	"stdout",
	"stderr",
	"output",
]);

function displayContentName(contentName: string): string {
	const colonIdx = contentName.indexOf(":");
	if (colonIdx === -1) return contentName;
	const rest = contentName.slice(colonIdx + 1);
	if (PI_LABEL_ONLY_SUFFIXES.has(rest)) return contentName;
	const trimmed = rest.replace(/[/\\]+$/, "");
	const sepIdx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
	const base = sepIdx === -1 ? trimmed : trimmed.slice(sepIdx + 1);
	return base || rest;
}

function buildPiReason(prefix: string, result: PiCheckResult): string {
	return `${prefix} in ${formatPiFinding(result)}`;
}

function formatPiFinding(result: PiCheckResult): string {
	const where = displayContentName(result.contentName);
	const score = `score: ${result.risk.toFixed(3)}`;
	const snippet = result.findings[0]?.replace(/\s+/g, " ").trim();
	if (snippet) return `${where} (${score}): "${snippet}"`;
	return `${where} (${score})`;
}

export class DecisionEngine {
	private readonly threshold: number;
	private readonly sensitivity: string;

	constructor(sensitivity = "balanced") {
		this.threshold = SENSITIVITY_THRESHOLDS[sensitivity] ?? CONFIDENCE_THRESHOLD;
		this.sensitivity = sensitivity;
	}

	async decide(sources: SignalSources): Promise<Verdict> {
		const signals = this.collectSignals(
			sources.heuristicMatches,
			sources.urlCheckResults,
			sources.packageCheckResults,
			sources.amsiCheckResults,
			sources.piCheckResults,
			sources.piThresholds,
		);

		if (signals.length === 0) {
			return this.allowVerdict();
		}

		signals.sort(
			(a, b) => (DECISION_PRIORITY[b.decision] ?? 0) - (DECISION_PRIORITY[a.decision] ?? 0),
		);
		const top = signals[0];
		if (!top) {
			return this.allowVerdict();
		}

		const allArtifacts = [...new Map(signals.map((s) => [s.artifact, s.artifact])).values()];
		const allReasons = [...new Map(signals.map((s) => [s.reason, s.reason])).values()];
		const maxConfidence = Math.max(...signals.map((s) => s.confidence));

		let decision = top.decision;
		// PI check signals bypass the sensitivity-driven deny→ask demotion: the
		// model already made a binary decision at its configured threshold and
		// the v8 model scores deny signals in the 0.93–0.99 band, which exceeds
		// every sensitivity level. Sensitivity coupling for medium-risk PI
		// signals lives in `collectSignals` (relaxed mode suppresses them) so
		// the suppressed signal never reaches the engine's decision step.
		if (decision === "deny" && maxConfidence < this.threshold && top.source !== "pi_check") {
			decision = "ask";
		}

		return {
			decision,
			category: top.category,
			confidence: maxConfidence,
			severity: top.severity,
			source: top.source,
			artifacts: allArtifacts,
			matchedThreatId: top.threatId,
			reasons: allReasons,
		};
	}

	private collectSignals(
		heuristicMatches: HeuristicMatch[],
		urlCheckResults: UrlCheckResult[],
		packageCheckResults?: PackageCheckResult[],
		amsiCheckResults?: AmsiCheckResult[],
		piCheckResults?: PiCheckResult[],
		piThresholds?: { highRisk: number; mediumRisk: number },
	): Signal[] {
		const signals: Signal[] = [];

		for (const match of heuristicMatches) {
			signals.push({
				decision: ACTION_MAP[match.threat.action] ?? "ask",
				category: match.threat.category,
				confidence: match.threat.confidence,
				severity: SEVERITY_MAP[match.threat.severity] ?? "warning",
				source: "heuristic",
				threatId: match.threat.id,
				reason: match.threat.title,
				artifact: match.artifact,
			});
		}

		for (const result of urlCheckResults) {
			if (result.isMalicious) {
				const findingDetails = result.findings
					.map((f) => `${f.severityName}/${f.typeName}`)
					.join(", ");
				signals.push({
					decision: "deny",
					category: "network_egress",
					confidence: 1.0,
					severity: "critical",
					source: "url_check",
					threatId: null,
					reason: `Malicious URL (${findingDetails})`,
					artifact: result.url,
				});
			}
		}

		if (packageCheckResults) {
			for (const pkg of packageCheckResults) {
				if (pkg.verdict === "clean") continue;

				const signal = this.packageVerdictToSignal(pkg);
				if (signal) signals.push(signal);
			}
		}

		if (amsiCheckResults) {
			for (const result of amsiCheckResults) {
				if (result.isDetected) {
					signals.push({
						decision: "deny",
						category: "malware",
						confidence: 1.0,
						severity: "critical",
						source: "amsi",
						threatId: null,
						reason: `AMSI detected malware in ${result.contentName} (result=${result.amsiResult})`,
						artifact: result.contentName,
					});
				} else if (result.isBlockedByAdmin) {
					signals.push({
						decision: "deny",
						category: "malware",
						confidence: 0.9,
						severity: "critical",
						source: "amsi",
						threatId: null,
						reason: `AMSI: content blocked by admin policy in ${result.contentName} (result=${result.amsiResult})`,
						artifact: result.contentName,
					});
				}
			}
		}

		if (piCheckResults) {
			const highRisk = piThresholds?.highRisk ?? DEFAULT_PI_HIGH_RISK_THRESHOLD;
			const mediumRisk = piThresholds?.mediumRisk ?? DEFAULT_PI_MEDIUM_RISK_THRESHOLD;
			const suppressMediumPi = this.sensitivity === "relaxed";

			for (const result of piCheckResults) {
				if (result.risk >= highRisk) {
					signals.push({
						decision: "deny",
						category: "prompt_injection",
						confidence: result.risk,
						severity: "critical",
						source: "pi_check",
						threatId: "PROMPT_INJECTION",
						reason: buildPiReason("Prompt injection detected", result),
						artifact: result.contentName,
					});
				} else if (!suppressMediumPi && result.risk >= mediumRisk) {
					signals.push({
						decision: "ask",
						category: "prompt_injection",
						confidence: result.risk,
						severity: "warning",
						source: "pi_check",
						threatId: "PROMPT_INJECTION",
						reason: buildPiReason("Suspicious content detected", result),
						artifact: result.contentName,
					});
				}
			}
		}

		return signals;
	}

	private packageVerdictToSignal(pkg: PackageCheckResult): Signal | null {
		switch (pkg.verdict) {
			case "not_found":
				return {
					decision: "deny",
					category: "supply_chain",
					confidence: 0.95,
					severity: "critical",
					source: "package_check",
					threatId: null,
					reason: pkg.details,
					artifact: pkg.packageName,
				};
			case "malicious":
				return {
					decision: "deny",
					category: "supply_chain",
					confidence: 1.0,
					severity: "critical",
					source: "package_check",
					threatId: null,
					reason: pkg.details,
					artifact: pkg.packageName,
				};
			case "suspicious_age":
				return {
					decision: "ask",
					category: "supply_chain",
					confidence: 0.75,
					severity: "warning",
					source: "package_check",
					threatId: null,
					reason: pkg.details,
					artifact: pkg.packageName,
				};
			case "unknown":
				return {
					decision: "ask",
					category: "supply_chain",
					confidence: 0.6,
					severity: "warning",
					source: "package_check",
					threatId: null,
					reason: pkg.details,
					artifact: pkg.packageName,
				};
			default:
				return null;
		}
	}

	private allowVerdict(): Verdict {
		return {
			decision: "allow",
			category: "none",
			confidence: 1.0,
			severity: "info",
			source: "none",
			artifacts: [],
			matchedThreatId: null,
			reasons: [],
		};
	}
}
