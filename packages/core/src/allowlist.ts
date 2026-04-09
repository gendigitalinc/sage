/**
 * User-managed allowlist for overriding false positives.
 * JSON file at ~/.sage/allowlist.json containing URLs, command hashes,
 * and file paths that the user has explicitly approved.
 */

import { resolvePath } from "./config.js";
import { getFileContent } from "./file-utils.js";
import type { Allowlist, AllowlistConfig, AllowlistEntry, Artifact, Logger } from "./types.js";
import { nullLogger } from "./types.js";
import { hashCommand, normalizeFilePath, normalizeUrl } from "./url-utils.js";

export function emptyAllowlist(): Allowlist {
	return { urls: {}, commands: {}, filePaths: {} };
}

function parseEntries(raw: Record<string, unknown>): Record<string, AllowlistEntry> {
	const entries: Record<string, AllowlistEntry> = {};
	for (const [key, entryData] of Object.entries(raw)) {
		if (typeof entryData !== "object" || entryData === null) continue;
		const data = entryData as Record<string, unknown>;
		if (
			typeof data.added_at === "string" &&
			typeof data.reason === "string" &&
			typeof data.original_verdict === "string"
		) {
			entries[key] = {
				addedAt: data.added_at,
				reason: data.reason,
				originalVerdict: data.original_verdict,
			};
		}
	}
	return entries;
}

export async function loadAllowlist(
	config: AllowlistConfig,
	logger: Logger = nullLogger,
): Promise<Allowlist> {
	const path = resolvePath(config.path);

	let raw: string;
	try {
		raw = await getFileContent(path);
	} catch {
		return emptyAllowlist();
	}

	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch (e) {
		logger.warn(`Failed to load allowlist from ${path}`, { error: String(e) });
		return emptyAllowlist();
	}

	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		logger.warn(`Allowlist file ${path} does not contain a JSON object`);
		return emptyAllowlist();
	}

	const record = data as Record<string, unknown>;
	const rawUrls = parseEntries((record.urls ?? {}) as Record<string, unknown>);
	// Normalize URL keys on load for backward compatibility with pre-normalization data
	const urls: Record<string, AllowlistEntry> = {};
	for (const [key, entry] of Object.entries(rawUrls)) {
		urls[normalizeUrl(key)] = entry;
	}
	// Normalize file path keys on load
	const rawFilePaths = parseEntries((record.file_paths ?? {}) as Record<string, unknown>);
	const filePaths: Record<string, AllowlistEntry> = {};
	for (const [key, entry] of Object.entries(rawFilePaths)) {
		filePaths[normalizeFilePath(key)] = entry;
	}
	return {
		urls,
		commands: parseEntries((record.commands ?? {}) as Record<string, unknown>),
		filePaths,
	};
}

export function isAllowlisted(allowlist: Allowlist, artifacts: Artifact[]): boolean {
	for (const artifact of artifacts) {
		if (artifact.type !== "command") {
			continue;
		}
		const cmdHash = hashCommand(artifact.value);
		if (cmdHash in allowlist.commands) {
			return true;
		}
	}

	for (const artifact of artifacts) {
		if (artifact.type !== "file_path") {
			continue;
		}
		if (normalizeFilePath(artifact.value) in allowlist.filePaths) {
			return true;
		}
	}

	// URL allowlist entries only short-circuit when every extracted artifact is a URL.
	// This prevents mixing a benign allowlisted URL with unrelated dangerous artifacts.
	if (artifacts.length > 0 && artifacts.every((artifact) => artifact.type === "url")) {
		return artifacts.every((artifact) => normalizeUrl(artifact.value) in allowlist.urls);
	}

	return false;
}
