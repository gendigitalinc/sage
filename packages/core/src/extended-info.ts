/**
 * Extended-info enrichment for Sage telemetry envelopes.
 *
 * Sage optionally reads `~/.sage/extended-info.json`, sanitizes it, and merges
 * its values into outgoing telemetry envelopes (heartbeat, detection, FP
 * report). The file may be absent — that is the normal case.
 *
 * Contract
 * --------
 * The contract is *structural*, not semantic. Sage validates the shape of the
 * file but never encodes a list of permitted field names. New identifiers can
 * be introduced without a Sage release, and Sage releases never leak the
 * universe of possible field names into source control.
 *
 * Shape (statically: `Record<string, Record<string, string | number | boolean>>`):
 * - Top level: object with up to {@link EXTENDED_INFO_MAX_GROUPS} groups.
 * - Each group: object with up to {@link EXTENDED_INFO_MAX_KEYS_PER_GROUP} leaves.
 * - Each leaf: `string` / `number` / `boolean`. Strings are truncated at
 *   {@link EXTENDED_INFO_MAX_LEAF_CHARS} via {@link safeTruncate}.
 *
 * File-level rejection (returns `null`, no enrichment applied):
 * - Missing / unreadable file.
 * - File size > {@link EXTENDED_INFO_FILE_MAX_BYTES}.
 * - Invalid JSON.
 * - Top-level value is not a non-null, non-array object.
 * - Top-level key count > {@link EXTENDED_INFO_MAX_GROUPS}.
 *
 * Per-group / per-leaf sanitation (entry dropped, file retained):
 * - Group whose value is not a non-null, non-array object → drop the group.
 * - Group with > {@link EXTENDED_INFO_MAX_KEYS_PER_GROUP} keys → drop overflow
 *   in iteration order.
 * - Leaf whose value is not a primitive scalar → drop the leaf.
 * - String leaves are always truncated rather than rejected.
 *
 * Each drop emits one `logger.debug` line so a misbehaving writer is
 * discoverable in verbose logs without crashing telemetry.
 *
 * Merge semantics
 * ---------------
 * `mergeExtendedInfo` is "fill-nulls-only": Sage's own envelope values always
 * win, and extended-info only patches in values where Sage left the field
 * absent / `null` / `undefined`. The merge is exactly two levels deep — the
 * same depth the validator guarantees — so the implementation stays auditable.
 */

import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { safeTruncate } from "./content-snapshot.js";
import { getFileContent } from "./file-utils.js";
import type { Logger } from "./types.js";
import { nullLogger } from "./types.js";

export type ExtendedInfoLeaf = string | number | boolean;
export type ExtendedInfoGroup = Record<string, ExtendedInfoLeaf>;
export type ExtendedInfo = Record<string, ExtendedInfoGroup>;

export const EXTENDED_INFO_FILE_MAX_BYTES = 1024;
export const EXTENDED_INFO_MAX_GROUPS = 16;
export const EXTENDED_INFO_MAX_KEYS_PER_GROUP = 32;
export const EXTENDED_INFO_MAX_LEAF_CHARS = 256;
export const EXTENDED_INFO_FILENAME = "extended-info.json";

interface CacheEntry {
	value: ExtendedInfo | null;
}

/**
 * Process-lifetime cache keyed by absolute file path. The validator is the
 * expensive part of the pipeline (size check + parse + per-group/per-leaf
 * iteration); we cache the *sanitized* result, not the raw bytes, so the
 * sanitization cost is paid exactly once per `sageDirPath`.
 *
 * Multiple `sageDirPath` values (rare in production, common in tests) each
 * get their own entry. Tests can clear the cache with
 * {@link resetExtendedInfoCache}.
 */
const cache = new Map<string, CacheEntry>();

/** Test-only escape hatch — production callers never need this. */
export function resetExtendedInfoCache(): void {
	cache.clear();
}

// Renamed from `isPlainObject` to avoid colliding with the `isPlainObject`
// helper that ships inside bundled third-party code (Zod/util) in this
// package — esbuild silently renames one of the duplicates to `isPlainObject2`
// in the dist output, which is harmless at runtime but obscures the source of
// either helper for maintainers.
function isPlainObjectValue(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeLeaves(
	groupKey: string,
	rawGroup: Record<string, unknown>,
	logger: Logger,
): ExtendedInfoGroup {
	const entries = Object.entries(rawGroup);
	const overflow = entries.length > EXTENDED_INFO_MAX_KEYS_PER_GROUP;
	const retained = overflow ? entries.slice(0, EXTENDED_INFO_MAX_KEYS_PER_GROUP) : entries;
	if (overflow) {
		logger.debug(
			`extended-info: dropped overflow keys in group '${groupKey}' (kept first ${EXTENDED_INFO_MAX_KEYS_PER_GROUP} of ${entries.length})`,
		);
	}

	const out: ExtendedInfoGroup = {};
	for (const [leafKey, leafValue] of retained) {
		if (typeof leafValue === "string") {
			out[leafKey] = safeTruncate(leafValue, EXTENDED_INFO_MAX_LEAF_CHARS);
			continue;
		}
		if (typeof leafValue === "number" || typeof leafValue === "boolean") {
			out[leafKey] = leafValue;
			continue;
		}
		logger.debug(
			`extended-info: dropped non-scalar leaf '${groupKey}.${leafKey}' (type ${typeof leafValue})`,
		);
	}
	return out;
}

function sanitizeDocument(parsed: Record<string, unknown>, logger: Logger): ExtendedInfo {
	const out: ExtendedInfo = {};
	for (const [groupKey, groupValue] of Object.entries(parsed)) {
		if (!isPlainObjectValue(groupValue)) {
			logger.debug(`extended-info: dropped non-object group '${groupKey}'`);
			continue;
		}
		out[groupKey] = sanitizeLeaves(groupKey, groupValue, logger);
	}
	return out;
}

/**
 * Load and sanitize `~/.sage/extended-info.json`.
 *
 * Returns `null` whenever the document as a whole is rejected (missing,
 * oversize, malformed, wrong top-level shape). Returns a (possibly empty)
 * `ExtendedInfo` object otherwise — empty means every group failed validation
 * but the document itself was structurally valid; callers treat `{}` and
 * `null` identically (no fields to merge).
 *
 * Result is cached per `sageDirPath` for the process lifetime — the file is
 * not expected to change during a Sage session. Tests can call
 * {@link resetExtendedInfoCache}.
 */
export async function loadExtendedInfo(
	sageDirPath?: string,
	logger: Logger = nullLogger,
): Promise<ExtendedInfo | null> {
	const sageDir = sageDirPath ?? join(homedir(), ".sage");
	const filePath = join(sageDir, EXTENDED_INFO_FILENAME);

	const cached = cache.get(filePath);
	if (cached) return cached.value;

	const value = await loadExtendedInfoUncached(filePath, logger);
	cache.set(filePath, { value });
	return value;
}

async function loadExtendedInfoUncached(
	filePath: string,
	logger: Logger,
): Promise<ExtendedInfo | null> {
	let size: number;
	try {
		const info = await stat(filePath);
		if (!info.isFile()) {
			logger.debug(`extended-info: not a regular file at ${filePath}`);
			return null;
		}
		size = info.size;
	} catch {
		// Missing or unreadable — silent fail-open (no debug log because the
		// file's absence is the expected default).
		return null;
	}

	if (size > EXTENDED_INFO_FILE_MAX_BYTES) {
		logger.debug(
			`extended-info: file size ${size} exceeds cap ${EXTENDED_INFO_FILE_MAX_BYTES}; ignoring`,
		);
		return null;
	}

	let raw: string;
	try {
		raw = await getFileContent(filePath, "utf-8");
	} catch {
		return null;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		logger.debug(`extended-info: invalid JSON: ${err}`);
		return null;
	}

	if (!isPlainObjectValue(parsed)) {
		logger.debug("extended-info: top-level value is not a non-null object");
		return null;
	}

	const groupCount = Object.keys(parsed).length;
	if (groupCount > EXTENDED_INFO_MAX_GROUPS) {
		logger.debug(
			`extended-info: ${groupCount} top-level groups exceed cap ${EXTENDED_INFO_MAX_GROUPS}; rejecting whole file`,
		);
		return null;
	}

	return sanitizeDocument(parsed, logger);
}

/**
 * Merge sanitized extended-info into a Sage telemetry envelope.
 *
 * "Fill-nulls-only": Sage's own values always win. A group from extended-info
 * is patched in only where the envelope's corresponding group is missing or a
 * leaf inside it is `null`/`undefined`. If the envelope has set the group to
 * a primitive scalar (Sage already populated it as a non-object), the whole
 * group from extended-info is skipped — overwriting Sage's choice would
 * silently corrupt the schema.
 *
 * Returns a new top-level object; the caller's `envelope` reference is not
 * mutated. Group-level objects may be shared with the input envelope after
 * the merge — callers must treat the result as immutable.
 *
 * The two-level depth matches the validator's contract; we deliberately do
 * not implement generic recursion because doing so would let an unexpected
 * `extended-info.json` shape leak into telemetry without explicit review.
 */
export function mergeExtendedInfo(
	envelope: Record<string, unknown>,
	extendedInfo: ExtendedInfo | null,
): Record<string, unknown> {
	const out: Record<string, unknown> = { ...envelope };
	if (!extendedInfo) return out;

	for (const [groupKey, groupValue] of Object.entries(extendedInfo)) {
		const existing = out[groupKey];

		if (existing === undefined || existing === null) {
			out[groupKey] = { ...groupValue };
			continue;
		}

		if (!isPlainObjectValue(existing)) {
			// Sage already populated this slot with a primitive (rare; the
			// envelope schema currently only nests objects). Skip rather than
			// overwrite to preserve Sage's value verbatim.
			continue;
		}

		const merged: Record<string, unknown> = { ...existing };
		for (const [leafKey, leafValue] of Object.entries(groupValue)) {
			const current = merged[leafKey];
			if (current === undefined || current === null) {
				merged[leafKey] = leafValue;
			}
		}
		out[groupKey] = merged;
	}

	return out;
}
