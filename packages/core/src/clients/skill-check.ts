/**
 * HTTP client for the Sage skill-check API.
 * Posts skill IDs (content-addressed digests of skill packages) to the
 * proxy and returns the structured verdict. Fails-open (returns empty
 * results map) on any error.
 *
 * LEGAL NOTICE: The Avast API is provided exclusively for use within
 * the Sage project. See `clients/url-check.ts` for the full notice.
 */

import type { Logger } from "../types.js";
import { nullLogger } from "../types.js";
import { VERSION } from "../version.js";
import { resolveEndpoint } from "./url-check.js";

const DEFAULT_TIMEOUT = 5.0;
const SERVICE_NAME = "sage";
const MAX_IDS_PER_REQUEST = 50;

const REQUEST_HEADERS = [
	{ name: "Accept", value: "application/json" },
	{ name: "Content-Type", value: "application/json" },
	{ name: "User-Agent", value: SERVICE_NAME },
];

export type SkillRiskLevel = "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;

export interface SkillCheckResult {
	skillId: string;
	verdict?: string;
	overallRiskLevel?: SkillRiskLevel;
	summary?: string;
	recommendations: string[];
	threatCategories: string[];
}

export interface SkillCheckClientConfig {
	endpoint?: string;
	timeout_seconds?: number;
}

export class SkillCheckClient {
	private readonly endpoint: string;
	private readonly timeoutMs: number;
	private readonly logger: Logger;

	constructor(config?: SkillCheckClientConfig, logger: Logger = nullLogger) {
		this.endpoint = config?.endpoint ?? resolveEndpoint("/v2/skill-check");
		this.timeoutMs = (config?.timeout_seconds ?? DEFAULT_TIMEOUT) * 1000;
		this.logger = logger;
	}

	/**
	 * Check a list of skill IDs against the proxy.
	 *
	 * Returns a Map keyed by skill id. A `null` value means the proxy had
	 * no opinion on that skill (analogous to a clean verdict). Skill ids
	 * not found in the response are simply absent from the map.
	 *
	 * Fails-open: on any error returns an empty Map. Per-batch errors do
	 * not poison results from successful batches.
	 */
	async checkSkills(skillIds: string[]): Promise<Map<string, SkillCheckResult | null>> {
		const out = new Map<string, SkillCheckResult | null>();
		if (skillIds.length === 0) return out;

		// De-duplicate but preserve first-seen order.
		const unique = [...new Set(skillIds)];

		const batches: string[][] = [];
		for (let i = 0; i < unique.length; i += MAX_IDS_PER_REQUEST) {
			batches.push(unique.slice(i, i + MAX_IDS_PER_REQUEST));
		}

		const batchResults = await Promise.all(batches.map((batch) => this.checkBatch(batch)));
		for (const batch of batchResults) {
			for (const [id, result] of batch) {
				out.set(id, result);
			}
		}
		return out;
	}

	private async checkBatch(skillIds: string[]): Promise<Map<string, SkillCheckResult | null>> {
		const out = new Map<string, SkillCheckResult | null>();

		try {
			const response = await fetch(this.endpoint, {
				method: "POST",
				headers: Object.fromEntries(REQUEST_HEADERS.map((h) => [h.name, h.value])),
				body: JSON.stringify({
					skill_ids: skillIds,
					client_info: {
						product_name: SERVICE_NAME,
						product_version: VERSION,
					},
				}),
				signal: AbortSignal.timeout(this.timeoutMs),
			});

			if (!response.ok) {
				this.logger.warn(`SkillCheck HTTP error: ${response.status}`);
				return out;
			}

			const data = (await response.json()) as Record<string, unknown>;
			const results = (data.results ?? {}) as Record<string, unknown>;
			for (const id of skillIds) {
				if (!(id in results)) continue;
				const raw = results[id];
				if (raw === null || raw === undefined) {
					out.set(id, null);
					continue;
				}
				const parsed = this.parseResult(id, raw as Record<string, unknown>);
				out.set(id, parsed);
			}
		} catch (e) {
			this.logger.warn("SkillCheck batch request failed", { error: String(e) });
		}

		return out;
	}

	private parseResult(skillId: string, raw: Record<string, unknown>): SkillCheckResult {
		const recommendationsRaw = (raw.recommendations ?? []) as unknown[];
		const recommendations = recommendationsRaw.filter((r): r is string => typeof r === "string");
		const categoriesRaw = (raw.threat_categories ?? []) as unknown[];
		const threatCategories = categoriesRaw.filter((c): c is string => typeof c === "string");

		return {
			skillId,
			verdict: typeof raw.verdict === "string" ? raw.verdict : undefined,
			overallRiskLevel:
				typeof raw.overall_risk_level === "string" ? raw.overall_risk_level : undefined,
			summary: typeof raw.summary === "string" ? raw.summary : undefined,
			recommendations,
			threatCategories,
		};
	}
}
