/**
 * Detached worker that uploads unknown skills to the Skill Analyzer and caches
 * the verdicts. Reads its work list from the pending marker, processes skills
 * in parallel batches of {@link BATCH_SIZE}, writes each batch's results, then
 * moves to the next batch.
 *
 * Runs as a standalone process spawned by `spawnSkillUploadWorker` (see
 * session-start.ts) with `stdio: "ignore"`, so the only diagnostic channel is
 * the operational log. Always fail-open: a failed skill stays in the marker and
 * is retried next session (until its TTL); errors never propagate.
 *
 * Reusable orchestration is `runSkillUploadWorker`; the bottom of the file
 * handles worker-specific env parsing and auto-run when invoked as a script.
 */

import { basename, join } from "node:path";
import { logSkillVerdict } from "./audit-log.js";
import type { SkillAnalyzeMetadata, SkillAnalyzeResult } from "./clients/skill-analyze.js";
import { SkillAnalyzeClient } from "./clients/skill-analyze.js";
import { loadConfig, resolvePath, SAGE_DIR, skillCacheTtlMs } from "./config.js";
import { createOperationalLogger } from "./operational-log.js";
import { entriesFromDirectory, MAX_SKILL_BYTES } from "./skill-id.js";
import {
	listPending,
	loadPendingMarker,
	removePending,
	savePendingMarker,
} from "./skill-pending.js";
import { loadSkillVerdictCache, putVerdict, saveSkillVerdictCache } from "./skill-verdict-cache.js";
import { recordAnalyzedSkillVerdict } from "./skill-verdict-record.js";
import { SkillTooLargeError, zipEntriesWithLimit } from "./skill-zip.js";
import { type AgentRuntime, type Logger, type LoggingConfig, nullLogger } from "./types.js";

const MAX_ZIP_BYTES = MAX_SKILL_BYTES;
/**
 * Concurrent uploads per batch. Kept deliberately low so a client stays well
 * within the analyzer's rate limit, while still overlapping the slow (~seconds)
 * per-skill analysis.
 */
const BATCH_SIZE = 3;

function chunk<T>(arr: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
}

/** Minimal analyzer surface, so tests can inject a fake without HTTP. */
export interface SkillAnalyzer {
	analyzeZip(zip: Uint8Array, metadata?: SkillAnalyzeMetadata): Promise<SkillAnalyzeResult | null>;
}

export interface SkillUploadWorkerArgs {
	pendingPath?: string;
	verdictCachePath?: string;
	/** Injected analyzer client (defaults to the real {@link SkillAnalyzeClient}). */
	client?: SkillAnalyzer;
	logger?: Logger;
	loggingConfig?: LoggingConfig;
	/** Verdict cache TTL in ms; drives prune-on-load. Defaults to 1 day. */
	verdictTtlMs?: number;
	/** Fallback origin runtime for pending entries queued without one. */
	agentRuntime?: string;
}

export interface SkillUploadWorkerResult {
	/** Skills successfully analyzed and cached this run. */
	analyzed: number;
	/** Skills left pending (analyzer failed / unreachable, or the verdict cache could not be written) for retry. */
	retained: number;
}

type UploadOutcome =
	| { tag: "ok"; result: SkillAnalyzeResult }
	| { tag: "no_verdict" }
	| { tag: "too_large" }
	| { tag: "empty" }
	| { tag: "error"; error: unknown };

async function zipAndUpload(
	folder: string,
	skillId: string,
	client: SkillAnalyzer,
	logger: Logger,
): Promise<UploadOutcome> {
	try {
		// Bound the read at the cap (not just the zip output): abort before pulling
		// an oversized folder fully into memory. A skill that was ≤50 MB at scan
		// time can grow past it before this detached worker runs; without the cap
		// the whole folder would be read into RAM first. Same SkillTooLargeError
		// outcome as zipEntriesWithLimit, just earlier. maxBytes only bounds the
		// byte counter — path/symlink containment is unchanged.
		const entries = await entriesFromDirectory(folder, MAX_ZIP_BYTES);
		// Nothing to submit. Terminal instead, like `too_large`.
		//
		// Reachable two ways: every file was filtered out by the symlink-escape
		// check in `entriesFromDirectory` (the folder's content resolves outside
		// the skill root), or the folder was emptied between the session-start scan
		// that queued it and this detached worker. A folder that is empty at scan
		// time never gets here — discovery requires a `SKILL.md`.
		if (entries.length === 0) {
			logger.warn("Skill has no readable entries; skipping upload", { skillId, folder });
			return { tag: "empty" };
		}
		const zip = zipEntriesWithLimit(entries, MAX_ZIP_BYTES);
		const result = await client.analyzeZip(zip, { skillId, slug: basename(folder) });
		if (!result || !result.verdict) return { tag: "no_verdict" };
		return { tag: "ok", result };
	} catch (e) {
		if (e instanceof SkillTooLargeError) {
			logger.warn("Skill ZIP exceeds 50 MB limit; skipping upload", { skillId });
			return { tag: "too_large" };
		}
		return { tag: "error", error: e };
	}
}

/**
 * Process every pending skill in parallel batches of {@link BATCH_SIZE}.
 * Within each batch all uploads run concurrently; verdicts are written and
 * the marker is cleared once per batch. Per-skill fail-open: a skill whose
 * upload fails stays in the marker (so it retries) and does not block siblings.
 */
export async function runSkillUploadWorker(
	args: SkillUploadWorkerArgs = {},
): Promise<SkillUploadWorkerResult> {
	const logger = args.logger ?? nullLogger;
	const { loggingConfig } = args;
	const client = args.client ?? new SkillAnalyzeClient(undefined, logger);

	const marker = await loadPendingMarker(args.pendingPath, logger);
	const pending = listPending(marker);
	if (pending.length === 0) return { analyzed: 0, retained: 0 };

	let analyzed = 0;
	let retained = 0;

	type PendingSkill = (typeof pending)[number];

	for (const batch of chunk(pending, BATCH_SIZE)) {
		const results = await Promise.all(
			batch.map(async (skill) => ({
				skill,
				outcome: await zipAndUpload(skill.folder, skill.skillId, client, logger),
			})),
		);

		const successes: Array<{ skill: PendingSkill; result: SkillAnalyzeResult }> = [];
		/** Skills that can never be uploaded; cached as a sentinel instead of retried. */
		const terminal: string[] = [];

		for (const {
			skill,
			skill: { skillId },
			outcome,
		} of results) {
			if (outcome.tag === "error") {
				retained += 1;
				logger.warn("Skill upload failed; leaving pending", {
					skillId,
					error: String(outcome.error),
				});
				if (loggingConfig) {
					logSkillVerdict(loggingConfig, skillId, "error", undefined, undefined, {
						agentRuntime: skill.agentRuntime ?? args.agentRuntime,
					}).catch(() => {});
				}
			} else if (outcome.tag === "no_verdict") {
				retained += 1;
				logger.debug("Skill analysis returned no verdict; leaving pending", { skillId });
				if (loggingConfig) {
					logSkillVerdict(loggingConfig, skillId, "no_verdict", undefined, undefined, {
						agentRuntime: skill.agentRuntime ?? args.agentRuntime,
					}).catch(() => {});
				}
			} else if (outcome.tag === "ok") {
				successes.push({ skill, result: outcome.result });
			} else if (outcome.tag === "too_large" || outcome.tag === "empty") {
				// Terminal: this skill can never be uploaded. Cache a sentinel verdict
				// (no verdict string = allow-equivalent, consistent with fail-open) and
				// remove from pending so the scanner stops deferring cache for it and no
				// later session re-submits it.
				terminal.push(skillId);
				if (loggingConfig) {
					logSkillVerdict(loggingConfig, skillId, outcome.tag, undefined, undefined, {
						agentRuntime: skill.agentRuntime ?? args.agentRuntime,
					}).catch(() => {});
				}
			}
		}

		if (successes.length === 0 && terminal.length === 0) continue;

		// Batch write: one load-modify-save for all resolved skills in this batch.
		// The cache remains an FP-selection fallback if operational audit storage
		// is unavailable or rotates before the verdict TTL expires.
		const cache = await loadSkillVerdictCache(args.verdictCachePath, args.verdictTtlMs, logger);
		const recorded = successes.map(({ skill, result }) =>
			recordAnalyzedSkillVerdict(cache, skill.skillId, result, {
				skillName: basename(skill.folder),
				agentRuntime: skill.agentRuntime ?? args.agentRuntime,
				containerKey: skill.containerKey,
				loggingConfig,
			}),
		);
		for (const skillId of terminal) {
			putVerdict(cache, skillId, {});
		}
		const cacheSaved = await saveSkillVerdictCache(cache, args.verdictCachePath, logger);

		// Batch clear from marker: re-read once, remove all resolved skills, save once.
		const fresh = await loadPendingMarker(args.pendingPath, logger);
		if (cacheSaved) {
			for (const { skill } of successes) {
				removePending(fresh, skill.skillId);
			}
			for (const skillId of terminal) {
				removePending(fresh, skillId);
			}
			analyzed += successes.length;
			// Audit only now: a skill left pending by a failed save is retried with a
			// fresh entryId, and an entry logged before the save would be orphaned.
			// A failed audit write must not abort the marker clear below: the verdict
			// is already cached, so re-uploading the skill would gain nothing.
			await Promise.all(recorded.map((entry) => entry.writeAuditEntry().catch(() => {})));
			for (const { skill, result } of successes) {
				logger.debug("Skill analyzed and cached", {
					skillId: skill.skillId,
					risk: result.verdict,
				});
			}
		} else {
			retained += successes.length + terminal.length;
		}
		await savePendingMarker(fresh, args.pendingPath, logger);
	}

	return { analyzed, retained };
}

// ── Worker entrypoint (standalone process) ────────────────────────────

async function workerMain(): Promise<void> {
	const sageDir = process.env.SAGE_DIR ? resolvePath(process.env.SAGE_DIR) : resolvePath(SAGE_DIR);
	const agentRuntime = (process.env.SAGE_AGENT_RUNTIME ?? "unknown") as AgentRuntime;

	let logger: Logger = nullLogger;
	let loggingConfig: LoggingConfig | undefined;
	let verdictTtlMs: number | undefined;
	try {
		const config = await loadConfig();
		logger = createOperationalLogger(config.operational_logging, agentRuntime).forComponent(
			"skill-upload-worker",
		);
		loggingConfig = config.logging;
		verdictTtlMs = skillCacheTtlMs(config);
	} catch {
		logger = nullLogger;
	}

	try {
		const result = await runSkillUploadWorker({
			pendingPath: join(sageDir, "skill_pending.json"),
			verdictCachePath: join(sageDir, "skill_verdict_cache.json"),
			logger,
			loggingConfig,
			verdictTtlMs,
			agentRuntime,
		});
		logger.debug("Skill upload worker completed", { result: "completed", ...result });
	} catch (error) {
		logger.error("Skill upload worker failed open", { error: String(error) });
	}
	await logger.flush?.();
}

// Auto-run only when this file is the actual process entrypoint (name match on
// argv[1]) AND SAGE_DIR is set (always set by spawnSkillUploadWorker). Keeps the
// auto-run from firing when the module is merely imported elsewhere.
const isWorkerEntry = (() => {
	try {
		const argv1 = process.argv[1] ?? "";
		const looksLikeWorker =
			argv1.endsWith("skill-upload-worker.cjs") || argv1.endsWith("skill-upload-worker.js");
		return looksLikeWorker && typeof process.env.SAGE_DIR === "string";
	} catch {
		return false;
	}
})();

if (isWorkerEntry) {
	workerMain().catch(() => {
		// Always fail-open.
		process.exit(0);
	});
}
