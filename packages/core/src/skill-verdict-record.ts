/**
 * Identity and coordinated persistence of one analyzed skill verdict.
 *
 * Analyzer results arrive on two independent paths — the session-start lookup
 * (`plugin-scanner`) and the detached upload worker — and both must store the
 * result in the verdict cache and mirror it into the audit log. The FP tools
 * merge those two stores and treat `entryId` as the join key, so the id is
 * minted here once for both writes rather than re-derived on each path.
 * Readers resolve that same id back through {@link resolveSkillVerdictEntryId}.
 *
 * The two writes are deliberately not performed together: the cache mutation
 * is immediate, the audit write is handed back as {@link
 * RecordedSkillVerdict.writeAuditEntry} so each path can run it only once its
 * cache save is known to have persisted. Auditing earlier orphans the entry —
 * a skill whose save failed is retried and re-recorded under a fresh id.
 */
import { createHash, randomUUID } from "node:crypto";
import { logSkillVerdict } from "./audit-log.js";
import {
	type CachedSkillVerdict,
	putVerdict,
	type SkillVerdictCache,
} from "./skill-verdict-cache.js";
import type { LoggingConfig } from "./types.js";

/** Analyzer result fields both call sites carry, however they obtained them. */
export interface AnalyzedSkillVerdict {
	verdict?: string;
	summary?: string;
	jobId?: string;
}

/** Where the skill was found, plus the audit sink to mirror the verdict into. */
export interface SkillVerdictOrigin {
	/** Skill folder name (slug), for user-facing display. */
	skillName?: string;
	agentRuntime?: string;
	containerKey?: string;
	/** Omitted when audit logging is disabled; the cache write still happens. */
	loggingConfig?: LoggingConfig;
}

/** A cached verdict whose audit entry has not been written yet. */
export interface RecordedSkillVerdict {
	/** The join key stored on the cache row and logged with the audit entry. */
	entryId: string;
	/**
	 * Mirror the verdict into the audit log under {@link entryId}. Call only
	 * once the cache save succeeded: a retried skill gets a fresh `entryId`, so
	 * logging before the save can leave an orphaned "analyzed" row behind that
	 * no cache entry joins to. No-op when audit logging is disabled.
	 */
	writeAuditEntry: () => Promise<void>;
}

/**
 * Cache an analyzed verdict under a fresh `entryId` and hand back the audit
 * write to run after the cache is persisted. The cache is mutated in memory
 * only — the caller decides when to save it, and whether a failed save means
 * the work must be retried.
 */
export function recordAnalyzedSkillVerdict(
	cache: SkillVerdictCache,
	skillId: string,
	result: AnalyzedSkillVerdict,
	origin: SkillVerdictOrigin,
): RecordedSkillVerdict {
	const entryId = randomUUID();
	putVerdict(cache, skillId, {
		entryId,
		jobId: result.jobId,
		verdict: result.verdict,
		summary: result.summary,
		skillName: origin.skillName,
		sources: [{ agentRuntime: origin.agentRuntime, containerKey: origin.containerKey }],
	});
	const { loggingConfig } = origin;
	return {
		entryId,
		writeAuditEntry: async () => {
			if (!loggingConfig) return;
			await logSkillVerdict(loggingConfig, skillId, "analyzed", result.verdict, result.summary, {
				entryId,
				jobId: result.jobId,
				agentRuntime: origin.agentRuntime,
			});
		},
	};
}

/**
 * Sage-owned UUID namespace (`75bba79a-3761-42a7-bacb-f95d791126d3`). Randomly
 * generated rather than one of the well-known RFC 4122 namespaces, so derived
 * ids cannot collide with a v5 UUID some unrelated tool built from the same name.
 */
const SKILL_ENTRY_ID_NAMESPACE = Buffer.from("75bba79a376142a7bacbf95d791126d3", "hex");

/** Stable RFC 4122 UUIDv5 for cache rows written before entry IDs were persisted. */
function legacySkillEntryId(skillId: string, analyzedAt: string): string {
	const bytes = createHash("sha1")
		.update(SKILL_ENTRY_ID_NAMESPACE)
		.update(`${skillId.toLowerCase()}:${analyzedAt}`)
		.digest()
		.subarray(0, 16);
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
	const hex = bytes.toString("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The join key for a cached verdict. Rows written by
 * {@link recordAnalyzedSkillVerdict} carry the id their audit entry was logged
 * under; rows predating that field get a deterministic stand-in derived from
 * the skill id and analysis time, so one row keeps one id across every listing
 * and report.
 */
export function resolveSkillVerdictEntryId(skillId: string, entry: CachedSkillVerdict): string {
	return entry.entryId ?? legacySkillEntryId(skillId, entry.analyzedAt);
}
