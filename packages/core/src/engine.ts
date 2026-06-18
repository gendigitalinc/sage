/**
 * Decision engine — combines signals into a final Verdict.
 */

import { applyPolicy, SENSITIVITY_POLICY } from "./policy.js";
import type {
	AmsiCheckResult,
	HeuristicMatch,
	Logger,
	PackageCheckResult,
	PiCheckResult,
	SignalSources,
	UrlCheckResult,
	Verdict,
	VerdictSeverity,
} from "./types.js";
import {
	DEFAULT_PI_HIGH_RISK_THRESHOLD,
	DEFAULT_PI_MEDIUM_RISK_THRESHOLD,
	nullLogger,
} from "./types.js";

interface Signal {
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
	private readonly denyThreshold: number;
	private readonly askThreshold: number;
	private readonly logger: Logger;

	constructor(sensitivity = "balanced", logger: Logger = nullLogger) {
		const policy = SENSITIVITY_POLICY[sensitivity] ?? SENSITIVITY_POLICY.balanced;
		this.denyThreshold = policy.denyThreshold;
		this.askThreshold = policy.askThreshold;
		this.logger = logger;
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

		const top = signals.reduce((best, s) => (s.confidence > best.confidence ? s : best));
		const maxConfidence = top.confidence;
		const decision = applyPolicy(maxConfidence, this.denyThreshold, this.askThreshold, this.logger);

		const allArtifacts = [...new Map(signals.map((s) => [s.artifact, s.artifact])).values()];
		const allReasons = [...new Map(signals.map((s) => [s.reason, s.reason])).values()];

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

		// Heuristics can fire hundreds of times per call (one match per pattern per extracted artifact).
		// Other sources (URL, package, AMSI, PI) produce at most a handful of results and are always collected.
		// Early-filtering allow-results here is safe: allow signals never influence the final verdict.
		for (const match of heuristicMatches) {
			const { confidence, category, severity, id, title } = match.threat;
			if (applyPolicy(confidence, this.denyThreshold, this.askThreshold, this.logger) === "allow")
				continue;
			signals.push({
				category,
				confidence,
				severity,
				source: "heuristic",
				threatId: id,
				reason: title,
				artifact: match.artifact,
			});
		}

		for (const result of urlCheckResults) {
			if (result.isMalicious) {
				const confidence = 1.0;
				const findingDetails = result.findings
					.map((f) => `${f.severityName}/${f.typeName}`)
					.join(", ");
				signals.push({
					category: "network_egress",
					confidence,
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

			for (const result of piCheckResults) {
				if (result.risk >= highRisk) {
					signals.push({
						category: "prompt_injection",
						confidence: 1.0,
						severity: "critical",
						source: "pi_check",
						threatId: "PROMPT_INJECTION",
						reason: buildPiReason("Prompt injection detected", result),
						artifact: result.contentName,
					});
				} else if (result.risk >= mediumRisk) {
					// 0.6 is intentionally below relaxed askThreshold (0.70): medium-risk PI is
					// suppressed in relaxed mode but still triggers ask in balanced/paranoid.
					signals.push({
						category: "prompt_injection",
						confidence: 0.6,
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
			case "malicious":
				return {
					category: "supply_chain",
					confidence: pkg.confidence,
					severity: "critical",
					source: "package_check",
					threatId: null,
					reason: pkg.details,
					artifact: pkg.packageName,
				};
			case "suspicious_age":
			case "unknown":
				return {
					category: "supply_chain",
					confidence: pkg.confidence,
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
		// confidence: 0.0 is intentional — no threat signal means zero confidence in a threat.
		// allowVerdict() results never flow through applyPolicy (which rejects confidence <= 0),
		// so this value does not violate the applyPolicy invariant; it simply marks "no detection."
		return {
			decision: "allow",
			category: "none",
			confidence: 0.0,
			severity: "info",
			source: "none",
			artifacts: [],
			matchedThreatId: null,
			reasons: [],
		};
	}
}
