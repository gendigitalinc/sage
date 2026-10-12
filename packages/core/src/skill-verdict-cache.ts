/**
 * Persistent cache of Skill Analyzer verdicts, keyed by content-addressed skill
 * id. This is the source of truth for the upload flow: the detached worker
 * writes verdicts here, and every later session reads them at session start —
 * even sessions that did not trigger the upload.
 *
 * Cross-process: written by the worker, read by the scan — hence a file. All
 * writes are atomic (temp + rename). Fails-open everywhere.
 */

import { join } from "node:path";
import { isFreshTimestamp, MS_PER_DAY, resolvePath, SAGE_DIR } from "./config.js";
import { atomicWriteJson, getFileContent, getFileContentSync } from "./file-utils.js";
import type { Logger } from "./types.js";
import { nullLogger } from "./types.js";

const SCHEMA_VERSION = 1;
/**
 * Fallback verdict TTL used when a caller does not supply one. Mirrors the
 * `skill_check.cache_ttl_days` config default (1 day) so the plugin scan cache
 * and the verdict cache expire on the same cadence.
 */
export const DEFAULT_VERDICT_TTL_MS = MS_PER_DAY;

/** One place a skill was discovered (agent runtime + container pseudo-plugin). */
export interface SkillVerdictSource {
	/** Agent runtime whose scan discovered the skill (e.g. "cursor"). */
	agentRuntime?: string;
	/** Pseudo-plugin key of the container the skill was found in. */
	containerKey?: string;
}

export interface CachedSkillVerdict {
	/** Audit/report event identifier shared with the corresponding skill_verdict entry. */
	entryId?: string;
	/** Analyzer job identifier used to correlate false-positive reports. */
	jobId?: string;
	verdict?: string;
	summary?: string;
	/** Skill folder name (slug), for user-facing display. */
	skillName?: string;
	/** Where the skill was discovered; merged across writes (see putVerdict). */
	sources?: SkillVerdictSource[];
	/** ISO timestamp of when the analysis completed; drives TTL. */
	analyzedAt: string;
}

function parseSources(raw: unknown): SkillVerdictSource[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const sources: SkillVerdictSource[] = [];
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const entry = item as Record<string, unknown>;
		const source: SkillVerdictSource = {
			agentRuntime: typeof entry.agent_runtime === "string" ? entry.agent_runtime : undefined,
			containerKey: typeof entry.container_key === "string" ? entry.container_key : undefined,
		};
		if (source.agentRuntime || source.containerKey) sources.push(source);
	}
	return sources.length > 0 ? sources : undefined;
}

/**
 * Union of two source lists, deduped on `agentRuntime` (first occurrence wins,
 * keeping its `containerKey`). Only `agentRuntime` is ever consumed (by the
 * status line's `foreignSourceRuntime`); deduping on the full
 * (agentRuntime, containerKey) tuple let the array grow once per plugin a skill
 * appeared in. Keying on runtime alone bounds it to the handful of distinct
 * runtimes without changing any observable behavior.
 */
function mergeSources(
	existing: SkillVerdictSource[] | undefined,
	incoming: SkillVerdictSource[] | undefined,
): SkillVerdictSource[] | undefined {
	const merged: SkillVerdictSource[] = [];
	const seen = new Set<string>();
	for (const source of [...(existing ?? []), ...(incoming ?? [])]) {
		const key = source.agentRuntime ?? "";
		if (seen.has(key)) continue;
		seen.add(key);
		merged.push(source);
	}
	return merged.length > 0 ? merged : undefined;
}

export interface SkillVerdictCache {
	entries: Record<string, CachedSkillVerdict>;
}

function defaultCachePath(): string {
	return join(resolvePath(SAGE_DIR), "skill_verdict_cache.json");
}

/**
 * Load the verdict cache. Entries older than {@link ttlMs} are dropped and the
 * file is rewritten immediately so the cache stays bounded over time.
 * Fails-open: returns an empty cache on a missing/corrupt file.
 */
async function loadSkillVerdictCacheInternal(
	cachePath: string,
	ttlMs: number,
	logger: Logger,
	pruneOnLoad: boolean,
): Promise<SkillVerdictCache> {
	let raw: string;
	try {
		raw = await getFileContent(cachePath);
	} catch {
		return { entries: {} };
	}

	try {
		const data = JSON.parse(raw) as Record<string, unknown>;
		const rawEntries = (data.entries ?? {}) as Record<string, Record<string, unknown>>;
		const now = Date.now();
		const entries: Record<string, CachedSkillVerdict> = {};
		let pruned = 0;
		for (const [skillId, entry] of Object.entries(rawEntries)) {
			const analyzedAt = entry.analyzed_at as string | undefined;
			if (!analyzedAt) continue;
			const ts = Date.parse(analyzedAt);
			if (!isFreshTimestamp(ts, ttlMs, now)) {
				pruned++;
				continue;
			}
			entries[skillId] = {
				entryId: typeof entry.entry_id === "string" ? entry.entry_id : undefined,
				jobId: typeof entry.job_id === "string" ? entry.job_id : undefined,
				verdict: typeof entry.verdict === "string" ? entry.verdict : undefined,
				summary: typeof entry.summary === "string" ? entry.summary : undefined,
				skillName: typeof entry.skill_name === "string" ? entry.skill_name : undefined,
				sources: parseSources(entry.sources),
				analyzedAt,
			};
		}
		const cache = { entries };
		if (pruneOnLoad && pruned > 0) {
			logger.debug(`Pruned ${pruned} stale verdict(s) from cache`, { cachePath });
			await saveSkillVerdictCache(cache, cachePath, logger);
		}
		return cache;
	} catch (e) {
		logger.warn(`Failed to load verdict cache from ${cachePath}`, { error: String(e) });
		return { entries: {} };
	}
}

export async function loadSkillVerdictCache(
	cachePath = defaultCachePath(),
	ttlMs = DEFAULT_VERDICT_TTL_MS,
	logger: Logger = nullLogger,
): Promise<SkillVerdictCache> {
	return loadSkillVerdictCacheInternal(cachePath, ttlMs, logger, true);
}

/** TTL-filtered cache load that never rewrites disk; safe for concurrent readers. */
export async function loadSkillVerdictCacheReadOnly(
	cachePath = defaultCachePath(),
	ttlMs = DEFAULT_VERDICT_TTL_MS,
	logger: Logger = nullLogger,
): Promise<SkillVerdictCache> {
	return loadSkillVerdictCacheInternal(cachePath, ttlMs, logger, false);
}

/**
 * Synchronous, strictly read-only cache load for pollers like the Claude Code
 * statusline script. Unlike {@link loadSkillVerdictCache} it never prunes or
 * rewrites the file (prune-on-load stays async-only). Fails-open to an empty
 * cache on a missing/corrupt file.
 */
export function loadSkillVerdictCacheSync(cachePath = defaultCachePath()): SkillVerdictCache {
	try {
		const data = JSON.parse(getFileContentSync(cachePath)) as Record<string, unknown>;
		const rawEntries = (data.entries ?? {}) as Record<string, Record<string, unknown>>;
		const entries: Record<string, CachedSkillVerdict> = {};
		for (const [skillId, entry] of Object.entries(rawEntries)) {
			const analyzedAt = entry.analyzed_at;
			if (typeof analyzedAt !== "string") continue;
			entries[skillId] = {
				entryId: typeof entry.entry_id === "string" ? entry.entry_id : undefined,
				jobId: typeof entry.job_id === "string" ? entry.job_id : undefined,
				verdict: typeof entry.verdict === "string" ? entry.verdict : undefined,
				summary: typeof entry.summary === "string" ? entry.summary : undefined,
				skillName: typeof entry.skill_name === "string" ? entry.skill_name : undefined,
				sources: parseSources(entry.sources),
				analyzedAt,
			};
		}
		return { entries };
	} catch {
		return { entries: {} };
	}
}

/**
 * Entries with a HIGH/CRITICAL verdict (case-insensitive) analyzed strictly
 * after {@link sinceIso}, sorted newest first. Entries whose analyzedAt does
 * not parse are skipped; an unparsable sinceIso yields no matches.
 */
export function riskyVerdictsSince(
	cache: SkillVerdictCache,
	sinceIso: string,
): CachedSkillVerdict[] {
	const since = Date.parse(sinceIso);
	if (Number.isNaN(since)) return [];
	return Object.values(cache.entries)
		.map((entry) => ({ entry, ts: Date.parse(entry.analyzedAt) }))
		.filter(({ entry, ts }) => {
			if (Number.isNaN(ts) || ts <= since) return false;
			const risk = (entry.verdict ?? "").toUpperCase();
			return risk === "HIGH" || risk === "CRITICAL";
		})
		.sort((a, b) => b.ts - a.ts)
		.map(({ entry }) => entry);
}

/**
 * Persist the cache atomically. Fails-open: a failed write is logged and
 * reported as `false` rather than thrown, so callers that track retry state can
 * keep the work pending while callers that don't can ignore the result.
 */
export async function saveSkillVerdictCache(
	cache: SkillVerdictCache,
	cachePath = defaultCachePath(),
	logger: Logger = nullLogger,
): Promise<boolean> {
	try {
		const data = {
			schema_version: SCHEMA_VERSION,
			entries: Object.fromEntries(
				Object.entries(cache.entries).map(([skillId, v]) => [
					skillId,
					{
						entry_id: v.entryId,
						job_id: v.jobId,
						verdict: v.verdict,
						summary: v.summary,
						skill_name: v.skillName,
						sources: v.sources?.map((s) => ({
							agent_runtime: s.agentRuntime,
							container_key: s.containerKey,
						})),
						analyzed_at: v.analyzedAt,
					},
				]),
			),
		};
		await atomicWriteJson(cachePath, data);
		return true;
	} catch (e) {
		logger.warn(`Failed to save verdict cache to ${cachePath}`, { error: String(e) });
		return false;
	}
}

/**
 * Look up a cached verdict by skill id. Returns null when absent or expired
 * (older than {@link ttlMs}), so an expired verdict re-triggers a lookup/upload
 * like an unknown skill.
 */
export function getVerdict(
	cache: SkillVerdictCache,
	skillId: string,
	ttlMs = DEFAULT_VERDICT_TTL_MS,
): CachedSkillVerdict | null {
	const entry = cache.entries[skillId];
	if (!entry) return null;
	const ts = Date.parse(entry.analyzedAt);
	if (!isFreshTimestamp(ts, ttlMs)) return null;
	return entry;
}

/**
 * Store a verdict for a skill id (pure). Overwrites any existing entry except
 * `sources`, which is unioned with the previous entry's — the same skill
 * content can be installed in several agents/containers, and each discovery
 * must survive later re-analysis triggered elsewhere.
 */
export function putVerdict(
	cache: SkillVerdictCache,
	skillId: string,
	verdict: Omit<CachedSkillVerdict, "analyzedAt">,
): void {
	const existing = cache.entries[skillId];
	cache.entries[skillId] = {
		...verdict,
		sources: mergeSources(existing?.sources, verdict.sources),
		analyzedAt: new Date().toISOString(),
	};
}
