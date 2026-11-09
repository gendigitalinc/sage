/**
 * Heuristics engine — matches artifacts against loaded threat definitions.
 */

import { deobfuscate, deobfuscationContext } from "./deobfuscate.js";
import { extractUrls } from "./extractors.js";
import { extractDomain, isTrustedDomain } from "./trusted-domains.js";
import type { Artifact, HeuristicMatch, Threat, TrustedDomain } from "./types.js";

/**
 * Upper bound on deobfuscated variants scanned for one tool call, across all
 * artifacts. (`maxVariants` in `deobfuscate.ts` is the per-artifact bound.)
 */
const MAX_VARIANTS_PER_CALL = 16;

/** Threat IDs where trusted installer domains suppress matches. */
const TRUSTED_DOMAIN_SUPPRESSIBLE = new Set([
	"CLT-CMD-001",
	"CLT-CMD-002",
	"CLT-SUPPLY-001",
	"CLT-SUPPLY-004",
]);

export class HeuristicsEngine {
	private readonly threatMap: Map<string, Threat[]> = new Map();
	private readonly trustedDomains: TrustedDomain[];

	constructor(threats: Threat[], trustedDomains?: TrustedDomain[]) {
		this.trustedDomains = trustedDomains ?? [];

		for (const threat of threats) {
			for (const matchType of threat.matchOn) {
				// Route domain threats to url artifact type
				const artifactType = matchType === "domain" ? "url" : matchType;
				const existing = this.threatMap.get(artifactType);
				if (existing) {
					existing.push(threat);
				} else {
					this.threatMap.set(artifactType, [threat]);
				}
			}
		}
	}

	private isSuppressedByTrustedDomain(match: HeuristicMatch): boolean {
		if (this.trustedDomains.length === 0) return false;
		if (!TRUSTED_DOMAIN_SUPPRESSIBLE.has(match.threat.id)) return false;

		// Suppress only when the *matched* substring exclusively references trusted domains.
		// This prevents a trusted-domain "decoy" from suppressing a match that also contains
		// untrusted URLs elsewhere in the same command artifact.
		const urls = extractUrls(match.matchValue);
		if (urls.length === 0) return false;

		for (const url of urls) {
			const domain = extractDomain(url);
			if (!domain) return false;
			if (!isTrustedDomain(domain, this.trustedDomains)) return false;
		}
		return true;
	}

	match(artifacts: Artifact[]): HeuristicMatch[] {
		const matches: HeuristicMatch[] = [];

		for (const artifact of artifacts) {
			const threats = this.threatMap.get(artifact.type) ?? [];
			for (const threat of threats) {
				const m = threat.compiledPattern.exec(artifact.value);
				if (m) {
					matches.push({
						threat,
						artifact: artifact.value,
						matchValue: m[0],
					});
				}
			}
		}

		// Post-filter: suppress matches for trusted installer domains
		if (this.trustedDomains.length > 0) {
			return matches.filter((m) => !this.isSuppressedByTrustedDomain(m));
		}

		return matches;
	}

	/**
	 * Match deobfuscated variants of the `content` artifacts against this
	 * engine's prompt-injection rules only. Command, credential, URL and other
	 * rules never see decoded or folded text, so deobfuscation adds coverage for
	 * hidden instructions without widening any other rule's false-positive surface.
	 *
	 * A variant match is attributed to the *original* artifact (`artifact`), and
	 * only the short matched snippet (`matchValue`) comes from decoded text; the
	 * decoded variant itself is never stored or passed on.
	 *
	 * Each rule is reported at most once, and not at all when its ID is in
	 * `alreadyMatched` (the raw text already tripped it), so audit and telemetry
	 * signals are not duplicated.
	 */
	matchDeobfuscated(
		artifacts: readonly Artifact[],
		alreadyMatched: ReadonlySet<string> = new Set(),
	): HeuristicMatch[] {
		const piThreats = (this.threatMap.get("content") ?? []).filter(
			(t) => t.category === "prompt_injection",
		);
		if (piThreats.length === 0) return [];

		const matches: HeuristicMatch[] = [];
		const reported = new Set(alreadyMatched);
		let variantsLeft = MAX_VARIANTS_PER_CALL;
		for (const artifact of artifacts) {
			if (artifact.type !== "content") continue;
			for (const variant of deobfuscate(artifact.value)) {
				if (variantsLeft-- <= 0) return matches;
				for (const threat of piThreats) {
					if (reported.has(threat.id)) continue;
					const m = threat.compiledPattern.exec(variant.text);
					if (!m) continue;
					reported.add(threat.id);
					matches.push({
						threat,
						artifact: artifact.value,
						matchValue: m[0],
						context: deobfuscationContext(variant.techniques),
					});
				}
			}
		}
		return matches;
	}
}
