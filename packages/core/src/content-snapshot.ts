/**
 * Content-snapshot helpers used by audit log, detection telemetry, and FP reporting.
 *
 * This module is the single source of truth for truncation and home-directory redaction
 * applied to telemetry/forensic content fields, and hosts the unified
 * `buildContentSnapshot()` builder consumed by audit logging, detection telemetry, and
 * the FP-reporting tool.
 */

import { homedir } from "node:os";
import type { CanonicalToolType } from "./tool-names.js";
import type { Artifact, AuditSignals } from "./types.js";

/**
 * Per-field maximum lengths (UTF-16 code units) for the structured `content`
 * snapshot. Each value is enforced before the snapshot leaves the builder so
 * audit-log writes, detection POSTs, and FP-report payloads all share one set
 * of caps. The `content` snapshot is a triage **snippet**, not a full payload
 * — caps are sized to comfortably fit typical inputs and force-truncate the
 * pathological ones (heredocs, base64 blobs, query-string-laden URLs):
 *
 * - `command` 512:      enough for typical single-line commands; piped
 *                       heredocs / base64 blobs are intentionally cut.
 * - `url` 512:          covers the long tail of real URLs while bounding
 *                       query-string-laden tracking links.
 * - `file_path` 512:    generous for filesystem paths; longer values are
 *                       almost always artifact paths with embedded hashes.
 * - `package_name` 256: npm allows up to 214; leave margin for other registries.
 * - `package_version` 128 / `package_registry` 128.
 *
 * There is intentionally no separate total-size cap on the JSON-stringified
 * snapshot: the worst-case sum of all per-field caps is small enough
 * (~2 KB across all populated fields) that an additional iterative-halving
 * guard adds complexity without protecting against any payload the per-field
 * caps don't already bound.
 */
export const CONTENT_FIELD_LIMITS: Readonly<Record<string, number>> = Object.freeze({
	command: 512,
	url: 512,
	file_path: 512,
	package_name: 256,
	package_version: 128,
	package_registry: 128,
});

/**
 * Truncate a string to at most `maxLen` UTF-16 code units without splitting a
 * surrogate pair. JavaScript strings are UTF-16 sequences, so a naive
 * `value.slice(0, maxLen)` can leave a lone high surrogate at the boundary,
 * which (a) corrupts the character at the cut and (b) breaks downstream JSON
 * consumers that re-encode strict UTF-8.
 *
 * - Returns the original string when it already fits.
 * - When the cut would land between a high and low surrogate, drops the high
 *   surrogate (one extra code unit) so the resulting string is well-formed.
 *
 * The truncation budget is chars (UTF-16 code units), not bytes, matching
 * `string.length`. Callers that need byte-level guarantees should encode
 * separately and budget against `Buffer.byteLength`.
 */
export function safeTruncate(value: string, maxLen: number): string {
	if (maxLen <= 0) return "";
	if (value.length <= maxLen) return value;
	const cutIndex = maxLen;
	const codeUnit = value.charCodeAt(cutIndex - 1);
	// High surrogate is U+D800–U+DBFF; pair completes only with a following low surrogate
	// (U+DC00–U+DFFF). If the last kept code unit is a high surrogate, drop it.
	if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
		return value.slice(0, cutIndex - 1);
	}
	return value.slice(0, cutIndex);
}

/**
 * Replace the user's home-directory prefix with `~` in a string. Used to keep
 * usernames and machine-specific layouts out of audit logs and telemetry.
 *
 * Both Windows (`C:\Users\jane`) and POSIX (`/home/jane`) home directories are
 * normalized to forward slashes for prefix comparison; the original separators
 * are preserved in the returned suffix.
 *
 * - Returns the value unchanged when there is no home directory or no match.
 * - When the value equals the home directory exactly, returns `"~"`.
 * - Otherwise replaces only the leading prefix; later occurrences of the home
 *   string elsewhere in the value are left alone (this matches the FP-tool
 *   behavior introduced earlier and avoids accidental in-string substitutions
 *   inside e.g. JSON blobs).
 */
export function scrubHomePath(value: string): string {
	const home = homedir();
	if (!home) return value;
	const normalizedHome = home.replace(/\\/g, "/").replace(/\/+$/, "");
	if (!normalizedHome) return value;
	const normalizedValue = value.replace(/\\/g, "/");
	if (normalizedValue === normalizedHome) return "~";
	if (normalizedValue.startsWith(`${normalizedHome}/`)) {
		return `~/${normalizedValue.slice(normalizedHome.length + 1)}`;
	}
	return value;
}

function asString(v: unknown): string | undefined {
	return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Resolve the canonical `file_path` from a tool-input record, accepting the
 * three field-name variants that connectors emit before they normalize:
 * `file_path` (snake_case canonical), `filePath` (camelCase passthrough), and
 * `path` (Read-style). Mirrors the resolution order used historically by
 * `detection-telemetry.ts`.
 */
export function resolveFilePath(toolInput: Record<string, unknown>): string | undefined {
	return asString(toolInput.file_path) ?? asString(toolInput.filePath) ?? asString(toolInput.path);
}

/**
 * Resolve the first URL from a `WebFetch`-style toolInput. Handles the
 * Claude/Cursor `{ url }` shape and the VS Code `fetch_webpage` `{ urls: [] }`
 * shape (Copilot uses an array even when only one URL is provided).
 */
function resolveWebFetchUrl(toolInput: Record<string, unknown>): string | undefined {
	const single = asString(toolInput.url);
	if (single) return single;
	const urls = toolInput.urls;
	if (Array.isArray(urls)) {
		for (const u of urls) {
			if (typeof u === "string" && u.length > 0) return u;
		}
	}
	return undefined;
}

/**
 * Extract the first file path from an `apply_patch` text block. Mirrors the
 * regexes used by `extractFromApplyPatch` in `packages/extension/src/sage-hook.ts`
 * (`*** Add|Update|Delete File:` and `*** Move to|Rename File:`). The full set
 * of paths still rides along in `artifacts`; the snapshot keeps only the first.
 */
function extractFirstApplyPatchPath(patchText: string): string | undefined {
	if (!patchText) return undefined;
	const headerMatch = /\*{3}\s+(?:Add|Update|Delete)\s+File:\s*(.+)/.exec(patchText);
	if (headerMatch?.[1]) {
		const trimmed = headerMatch[1].trim();
		if (trimmed) return trimmed;
	}
	const renameMatch = /\*{3}\s+(?:Move\s+to|Rename\s+File):\s*(.+)/i.exec(patchText);
	if (renameMatch?.[1]) {
		const raw = renameMatch[1].trim();
		const arrow = raw.indexOf(" -> ");
		if (arrow !== -1) {
			const src = raw.slice(0, arrow).trim();
			if (src) return src;
			const dst = raw.slice(arrow + 4).trim();
			if (dst) return dst;
		} else if (raw) {
			return raw;
		}
	}
	return undefined;
}

/**
 * Inspect MCP nested toolInput to recover canonical content fields. MCP tool
 * payloads vary by server; many wrap the actual call inside `tool_input` /
 * `toolInput`, with the same canonical field names as their host
 * (`command` / `url` / `file_path`). When neither nesting is present, the
 * top-level toolInput is inspected as a fallback.
 *
 * Returns `undefined` for any field that isn't a non-empty string. Anything
 * that doesn't map cleanly is dropped — there is no catch-all `raw_input`
 * field so an oversized or unexpected MCP payload cannot leak into `content`.
 */
function extractMcpContent(toolInput: Record<string, unknown>): {
	command?: string;
	url?: string;
	file_path?: string;
} {
	const nestedRaw =
		(toolInput.tool_input as Record<string, unknown> | undefined) ??
		(toolInput.toolInput as Record<string, unknown> | undefined);
	const candidate =
		nestedRaw && typeof nestedRaw === "object" && !Array.isArray(nestedRaw) ? nestedRaw : toolInput;
	return {
		command: asString(candidate.command),
		url: asString(candidate.url) ?? resolveWebFetchUrl(candidate),
		file_path: resolveFilePath(candidate),
	};
}

/**
 * Find the first artifact whose `type` is `"url"` and return its value. Used
 * as a fallback for `WebFetch` when the toolInput lacks a usable `url` field
 * (e.g. when a connector synthesized the call from extracted artifacts).
 */
function firstUrlArtifact(artifacts: ReadonlyArray<Artifact>): string | undefined {
	for (const a of artifacts) {
		if (a.type === "url" && typeof a.value === "string" && a.value.length > 0) {
			return a.value;
		}
	}
	return undefined;
}

/**
 * Apply per-field redaction (home-path scrub) and per-field length caps to a
 * mutable content object. Mutates in place because the object is constructed
 * once per `evaluateToolCall` and never aliased.
 */
function applyFieldLimits(content: Record<string, unknown>): void {
	for (const [key, value] of Object.entries(content)) {
		if (typeof value !== "string") continue;
		let sanitized = value;
		if (key === "file_path" || key === "command") {
			sanitized = scrubHomePath(sanitized);
		}
		const limit = CONTENT_FIELD_LIMITS[key];
		if (limit && sanitized.length > limit) {
			sanitized = safeTruncate(sanitized, limit);
		}
		content[key] = sanitized;
	}
}

/**
 * Build the structured `content` snapshot stored in the audit log and sent in
 * detection / FP-report payloads. This is the single content builder for all
 * three call sites — `audit-log.ts`, `detection-telemetry.ts`, and the FP
 * tool all consume the object emitted here (the FP tool reads it back from
 * the audit entry; it never calls the builder directly).
 *
 * Behaviour by `toolType`:
 * - `Bash`        → `{ command }` from `toolInput.command`
 * - `WebFetch`    → `{ url }` from `toolInput.url`, the VS Code `urls[0]`
 *                   shape, or the first URL artifact (in that order)
 * - `Write`/`Edit`/`Read`/`Delete` → `{ file_path }` from
 *                   `toolInput.file_path` / `filePath` / `path`
 * - `ApplyPatch`  → `{ file_path }` = first path parsed from the patch text
 *                   (`*** Add|Update|Delete File:` / `*** Move to|Rename File:`)
 * - `MCP`         → any of `command` / `url` / `file_path` extractable from
 *                   nested `tool_input` / `toolInput`; nothing else
 * - everything else → `{}` (empty content)
 *
 * Cross-cutting (independent of toolType):
 * - Multi-malicious-URL: when toolType-specific extraction did not set
 *   `content.url` and `signals.url_checks` carries at least one entry, the
 *   first signal URL is used (deterministic — first in `signals.url_checks`
 *   order). Full multi-value detail stays in `signals`; `content` is a
 *   concise snapshot.
 * - Multi-package: when `signals.package_checks` is non-empty, the first
 *   entry's `package_name` / `package_version` / `package_registry` are
 *   copied into `content`. Same rationale as URL.
 *
 * Sanitization is applied to every string field after extraction:
 * - `file_path` and `command` are home-scrubbed via `scrubHomePath`.
 * - All fields are capped via `safeTruncate` to `CONTENT_FIELD_LIMITS[key]`.
 *
 * Returns a freshly allocated plain object; callers may mutate it (the
 * evaluator does not, but the contract permits it).
 */
export function buildContentSnapshot(
	toolType: CanonicalToolType,
	toolInput: Record<string, unknown>,
	artifacts: ReadonlyArray<Artifact> = [],
	signals: AuditSignals = {},
): Record<string, unknown> {
	const content: Record<string, unknown> = {};

	switch (toolType) {
		case "Bash": {
			const command = asString(toolInput.command);
			if (command) content.command = command;
			break;
		}
		case "WebFetch": {
			const url = resolveWebFetchUrl(toolInput) ?? firstUrlArtifact(artifacts);
			if (url) content.url = url;
			break;
		}
		case "Write":
		case "Edit":
		case "Read":
		case "Delete": {
			const filePath = resolveFilePath(toolInput);
			if (filePath) content.file_path = filePath;
			break;
		}
		case "ApplyPatch": {
			const patchText = asString(toolInput.input) ?? asString(toolInput.patch) ?? "";
			const filePath = extractFirstApplyPatchPath(patchText);
			if (filePath) content.file_path = filePath;
			break;
		}
		case "MCP": {
			const mcp = extractMcpContent(toolInput);
			if (mcp.command) content.command = mcp.command;
			if (mcp.url) content.url = mcp.url;
			if (mcp.file_path) content.file_path = mcp.file_path;
			break;
		}
		// Glob / Grep / List / CodeSearch / WebSearch / Question / Task / ReadLines / Unknown
		// intentionally produce no content fields — they have no FP-relevant snapshot today.
	}

	if (!content.url && signals.url_checks && signals.url_checks.length > 0) {
		const firstUrl = signals.url_checks[0]?.url;
		if (firstUrl) content.url = firstUrl;
	}
	if (signals.package_checks && signals.package_checks.length > 0) {
		const p = signals.package_checks[0];
		if (p?.package_name) content.package_name = p.package_name;
		if (p?.package_version) content.package_version = p.package_version;
		if (p?.package_registry) content.package_registry = p.package_registry;
	}

	applyFieldLimits(content);

	return content;
}
