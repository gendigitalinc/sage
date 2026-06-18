/**
 * URL and file path normalization utilities.
 * Used by cache, exceptions, and other modules that need consistent keys.
 */

import { normalize } from "node:path";
import { getHomeDir } from "./file-utils.js";

/** Normalize URL for consistent keys: lowercase scheme+host, remove fragment, sort params. */
export function normalizeUrl(raw: string): string {
	try {
		const u = new URL(raw);
		// URL constructor already lowercases protocol and hostname
		// Remove fragment (#...) since it's not sent to server
		u.hash = "";
		u.searchParams.sort();
		return u.toString();
	} catch {
		// If URL is malformed, use as-is (lowercase for best effort)
		return raw.toLowerCase();
	}
}

/** Normalize file path for consistent cache/exception keys: resolve ~, normalize . and .. */
export function normalizeFilePath(raw: string): string {
	const home = getHomeDir();
	const expanded = raw.startsWith("~/") || raw === "~" ? `${home}${raw.slice(1)}` : raw;
	return normalize(expanded);
}
