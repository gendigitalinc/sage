/**
 * Per-rule, per-installation telemetry submit cap — `~/.sage/submit-limits.json`.
 *
 * Submit-only (hunting / canary) rules can be broad, so every match must not
 * become a telemetry event. Following the AV precedent, each rule may submit at
 * most once per {@link SUBMIT_WINDOW_MS} (24h) from a given client. The file
 * maps rule id → epoch ms of the last submission.
 *
 * Fail-open for tool execution: nothing here throws. A missing or corrupt file
 * reads as empty (every rule eligible). When the claim cannot be persisted
 * (lock contention, unwritable home), the submission is suppressed instead —
 * an unrecordable cap would otherwise let a broad rule flood telemetry.
 *
 * JSON is snake_case per repo convention.
 */

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolvePath, SAGE_DIR } from "./config.js";
import { atomicWriteJson, getFileContent, withFileLock } from "./file-utils.js";
import type { Logger } from "./types.js";
import { nullLogger } from "./types.js";

export const SUBMIT_LIMITS_SCHEMA_VERSION = 1;

/** Minimum interval between two submissions of the same rule (24 hours). */
export const SUBMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SubmitLimitsOptions {
	/** Override `~/.sage` (tests). */
	sageDirPath?: string;
	/** Current time in epoch ms (tests). Defaults to `Date.now()`. */
	now?: number;
	logger?: Logger;
}

/** rule id → epoch ms of the last submission. */
export type SubmitLimits = Record<string, number>;

function submitLimitsPath(sageDirPath?: string): string {
	return join(sageDirPath ?? resolvePath(SAGE_DIR), "submit-limits.json");
}

function isEligible(limits: SubmitLimits, ruleId: string, now: number): boolean {
	const last = limits[ruleId];
	if (last === undefined) return true;
	// A timestamp in the future (clock moved backwards) must not lock the rule out.
	return now - last >= SUBMIT_WINDOW_MS || last > now;
}

/** Load the submit timestamps. Missing/corrupt file → empty. Never throws. */
export async function loadSubmitLimits(opts: SubmitLimitsOptions = {}): Promise<SubmitLimits> {
	const logger = opts.logger ?? nullLogger;
	let raw: string;
	try {
		raw = await getFileContent(submitLimitsPath(opts.sageDirPath));
	} catch {
		return {};
	}
	try {
		const data = JSON.parse(raw) as Record<string, unknown>;
		const rules = (data.rules ?? {}) as Record<string, unknown>;
		const limits: SubmitLimits = {};
		for (const [id, rec] of Object.entries(rules)) {
			const last = (rec as Record<string, unknown> | null)?.last_submitted_ms;
			if (typeof last === "number" && Number.isFinite(last)) limits[id] = last;
		}
		return limits;
	} catch (e) {
		logger.warn("Failed to parse submit limits; treating as empty", { error: String(e) });
		return {};
	}
}

async function saveSubmitLimits(limits: SubmitLimits, sageDirPath?: string): Promise<void> {
	await atomicWriteJson(submitLimitsPath(sageDirPath), {
		schema_version: SUBMIT_LIMITS_SCHEMA_VERSION,
		rules: Object.fromEntries(
			Object.entries(limits).map(([id, last]) => [id, { last_submitted_ms: last }]),
		),
	});
}

/**
 * Whether `ruleId` is outside its submit window. Never throws.
 * @internal Test helper; production code uses {@link claimRuleSubmissions}.
 */
export async function canSubmitRule(
	ruleId: string,
	opts: SubmitLimitsOptions = {},
): Promise<boolean> {
	const limits = await loadSubmitLimits(opts);
	return isEligible(limits, ruleId, opts.now ?? Date.now());
}

/**
 * Record a submission of `ruleId` at `now`. Never throws.
 * @internal Test helper; production code uses {@link claimRuleSubmissions}.
 */
export async function recordRuleSubmission(
	ruleId: string,
	opts: SubmitLimitsOptions = {},
): Promise<void> {
	await claimRuleSubmissions([ruleId], { ...opts, force: true });
}

/**
 * Atomically check-and-record: under a file lock, select the rules outside
 * their submit window, stamp them with `now`, persist, and return them. The
 * caller should submit telemetry only when the result is non-empty. Returns
 * `[]` when nothing is eligible or the claim could not be persisted.
 * Never throws.
 */
export async function claimRuleSubmissions(
	ruleIds: readonly string[],
	opts: SubmitLimitsOptions & { force?: boolean } = {},
): Promise<string[]> {
	const logger = opts.logger ?? nullLogger;
	const unique = [...new Set(ruleIds)];
	if (unique.length === 0) return [];

	const now = opts.now ?? Date.now();
	const path = submitLimitsPath(opts.sageDirPath);
	let claimed: string[] = [];
	try {
		// The lock is a sibling directory, so the parent must exist first.
		await mkdir(dirname(path), { recursive: true });
		await withFileLock(path, async () => {
			const limits = await loadSubmitLimits(opts);
			const eligible = opts.force ? unique : unique.filter((id) => isEligible(limits, id, now));
			if (eligible.length === 0) return;

			// Drop expired entries so the file doesn't grow with every rule ever seen.
			const next: SubmitLimits = {};
			for (const [id, last] of Object.entries(limits)) {
				if (isEligible(limits, id, now)) continue;
				next[id] = last;
			}
			for (const id of eligible) next[id] = now;

			await saveSubmitLimits(next, opts.sageDirPath);
			claimed = eligible;
		});
	} catch (e) {
		logger.warn("Failed to persist submit limits; suppressing submission", { error: String(e) });
		return [];
	}
	if (claimed.length === 0) logger.debug("Rule submissions capped", { ruleIds: unique });
	return claimed;
}
