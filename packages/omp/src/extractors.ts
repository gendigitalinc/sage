/**
 * Maps Oh My Pi tool calls to sage artifacts and canonical tool input.
 *
 * Tool schemas are verified against the upstream sources in
 * `oh-my-pi/packages/coding-agent/src/tools/**` and `.../edit/schemas.ts`
 * (OMP 18.8). Shapes below reflect the `tool_call` event payload — the
 * schema-shaped arguments after OMP's `normalizeToolEventInput` — not a
 * convenience fiction.
 *
 * Coverage policy: every OMP tool capable of executing code, reading/writing
 * files, or opening network endpoints emits at least one artifact. Tools that
 * can only read metadata (grep, find, glob, …) intentionally emit none —
 * sage's evaluator short-circuits to `allow` on `artifacts.length === 0`.
 */

import {
	type Artifact,
	type CanonicalToolType,
	canonicalizeToolName,
	extractFromBash,
	extractFromEdit,
	extractFromRead,
	extractFromWebFetch,
	extractFromWrite,
} from "@gendigital/sage-core";
import type { HookToolMapping } from "@gendigital/sage-hook-host";

/**
 * Raw OMP tool name → canonical label for every tool this connector guards.
 * Pinned by the tool-names contract fixture. Tools absent from this map are
 * intentionally unguarded; the README lists them and why.
 */
export const OMP_TOOL_MAP: Record<string, CanonicalToolType> = {
	bash: "Bash",
	eval: "Bash",
	debug: "Bash",
	write: "Write",
	edit: "Edit",
	ast_edit: "Edit",
	read: "Read",
};

/**
 * Translate an OMP tool call into the artifacts sage evaluates, the canonical
 * `toolInput` keys core reads, and the canonical tool label. Rule matching
 * keys off `match_on` (command/file_path/url/content), not the label, so the
 * label only affects audit/telemetry. Unknown tools emit no artifacts and pass
 * their input through: the handler short-circuits before the shape matters.
 *
 * SIBLING: `packages/pi/src/extractors.ts` is the parallel mapper for pi. The
 * two intentionally differ (OMP's edit modes are far richer), but fixes to a
 * shared concern — URL extraction, package/manifest handling, the canonical
 * keys — should be mirrored there.
 */
export function mapToolCall(toolName: string, input: Record<string, unknown>): HookToolMapping {
	switch (toolName) {
		case "bash":
			return mapCommand(input.command);
		case "eval":
			return mapCommand(input.code);
		case "debug":
			return mapCommand(debugCommandText(input));
		case "write": {
			const toolInput = {
				file_path: stringOrEmpty(input.path),
				content: stringOrEmpty(input.content),
			};
			return { toolName: "Write", toolInput, artifacts: extractFromWrite(toolInput) };
		}
		case "edit":
			return mapEdit(input);
		case "ast_edit":
			return mapAstEdit(input);
		case "read":
			return mapRead(input);
		default:
			return {
				toolName: canonicalizeToolName(OMP_TOOL_MAP, toolName),
				toolInput: input,
				artifacts: [],
			};
	}
}

function stringOrEmpty(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function nonEmptyString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

// ───────────────────────── Command-like tools ─────────────────────

/**
 * `bash.command`, `eval.code` (JS or Python cell), and `debug` launch /
 * evaluate text. Eval runs in a persistent kernel with full filesystem /
 * network / subprocess access — attack surface equivalent to bash — and is
 * also how OMP drives its browser prelude, so all of them are routed through
 * the bash extractor's heuristics.
 */
function mapCommand(value: unknown): HookToolMapping {
	const command = stringOrEmpty(value);
	return {
		toolName: "Bash",
		toolInput: { command },
		artifacts: command.length > 0 ? extractFromBash(command) : [],
	};
}

/**
 * OMP `debug` drives a DAP adapter: `launch` starts `program` with `args`,
 * `evaluate` runs `expression` in the debuggee or the adapter's REPL (gdb
 * `shell …`, Python `os.system(…)`), breakpoint `condition`s are evaluated
 * the same way, and `custom_request` sends a raw DAP `command` with
 * `arguments`. Read-only inspection actions carry none of these and emit
 * nothing.
 */
function debugCommandText(input: Record<string, unknown>): string {
	const parts: string[] = [];
	const program = stringOrEmpty(input.program);
	if (program.length > 0) {
		const args = Array.isArray(input.args)
			? input.args.filter((arg): arg is string => typeof arg === "string")
			: [];
		parts.push([program, ...args].join(" "));
	}
	for (const text of [input.expression, input.condition]) {
		if (typeof text === "string" && text.length > 0) parts.push(text);
	}
	const command = stringOrEmpty(input.command);
	if (command.length > 0) {
		parts.push(
			isRecord(input.arguments) ? `${command} ${JSON.stringify(input.arguments)}` : command,
		);
	}
	return parts.join("\n");
}

// ─────────────────────────── File tools ───────────────────────────

/** OMP's `isReadableUrlPath`: `read` routes these paths to its URL fetcher. */
const URL_PATH_PATTERN = /^(?:https?:\/\/?|www\.)/i;

/**
 * Canonicalizes the way OMP's fetcher does before requesting: repair a
 * collapsed scheme (`https:/host` → `https://host`, `repairCollapsedScheme`)
 * and prefix schemeless `www.` paths with `https://` (`normalizeUrl`), so
 * core's URL reputation check and PI content fetch see the URL OMP fetches.
 */
function toFetchableUrl(path: string): string {
	const repaired = path.replace(/^(https?):\/(?!\/)/i, "$1://");
	return /^https?:\/\//i.test(repaired) ? repaired : `https://${repaired}`;
}

/**
 * OMP's `read` routes URL-shaped paths to its URL fetcher; anything else
 * (local paths, archives, sqlite, internal URLs) is a local-resource read.
 */
function mapRead(input: Record<string, unknown>): HookToolMapping {
	const path = stringOrEmpty(input.path);
	if (URL_PATH_PATTERN.test(path)) {
		const url = toFetchableUrl(path);
		return { toolName: "WebFetch", toolInput: { url }, artifacts: extractFromWebFetch({ url }) };
	}
	const toolInput = { file_path: path };
	return { toolName: "Read", toolInput, artifacts: extractFromRead(toolInput) };
}

/**
 * Emits one `file_path` artifact per edited file and `edit_move` artifacts
 * for rename destinations, then scans everything the edit carries (post- AND
 * pre-change text, so URLs in removed supply-chain content are still
 * audited). The content scan never depends on a path being parsed: a payload
 * whose headers drift from sage's grammar must still be evaluated.
 */
function mapEdit(input: Record<string, unknown>): HookToolMapping {
	const { paths, renames, added, scanText } = parseEditInput(input);
	return {
		toolName: "Edit",
		// `file_path` prefers the first rename DESTINATION: after the edit
		// commits, the file lives there, and core's package-manifest parser
		// dispatches on its suffix. Without this, edit-then-rename-to-
		// `package.json` evades the manifest parser. `new_string` is the
		// post-change text only — AMSI/manifest scan the resulting file.
		//
		// Known gap: core checks package manifests on `toolInput.file_path`
		// only. A multi-file edit whose first path is not a manifest skips the
		// package check for a later `package.json`. Every path is still a
		// `file_path` artifact (path rules and heuristics see them); only the
		// manifest parser is first-path. The core union fix was reverted from
		// this PR.
		toolInput: { file_path: renames[0] ?? paths[0] ?? "", new_string: added.join("\n") },
		artifacts: [
			...fileArtifacts(paths, "edit"),
			...fileArtifacts(renames, "edit_move"),
			// No `file_path` here: every edited path is already emitted above.
			...extractFromEdit({ new_string: scanText }),
		],
	};
}

function fileArtifacts(paths: string[], context: string): Artifact[] {
	return paths.map((value): Artifact => ({ type: "file_path", value, context }));
}

/**
 * OMP `ast_edit`: structural rewrites over `paths` (file, directory, glob, or
 * internal URL) with `ops` of `{ pat, out }` replacement templates. The `out`
 * templates become the post-rewrite text; the `pat` patterns are pre-existing
 * source, scanned too like edit anchors.
 */
function mapAstEdit(input: Record<string, unknown>): HookToolMapping {
	const paths = Array.isArray(input.paths)
		? input.paths.filter((p): p is string => typeof p === "string" && p.length > 0)
		: [];
	const ops = Array.isArray(input.ops) ? input.ops.filter(isRecord) : [];
	const out = ops.map((op) => stringOrEmpty(op.out)).join("\n");
	const pat = ops.map((op) => stringOrEmpty(op.pat)).join("\n");
	return {
		toolName: "Edit",
		// `file_path` prefers the first target (core's package-manifest parser
		// dispatches on its suffix); `new_string` is the replacement templates.
		// Same first-path manifest gap as mapEdit: a later package.json in
		// `paths` is an artifact, but the manifest parser does not see it.
		toolInput: { file_path: paths[0] ?? "", new_string: out },
		artifacts: [
			...fileArtifacts(paths, "edit"),
			// No `file_path` here: every target path is already emitted above.
			...extractFromEdit({ new_string: [pat, out].filter(Boolean).join("\n") }),
		],
	};
}

// ──────────────────────────── Edit modes ──────────────────────────

/** Mode-independent view of an OMP edit call. */
interface ParsedEdit {
	/** Files the edit opens, creates, or deletes, in order of appearance. */
	paths: string[];
	/** Rename destinations (hashline `MV`, apply_patch `Move to`, patch `rename`). */
	renames: string[];
	/** Text present after the edit (inserted/replacement lines). */
	added: string[];
	/** Everything the edit carries — post- and pre-change — for heuristic scanning. */
	scanText: string;
}

/**
 * OMP's `edit` schema depends on the active edit mode (`edit/schemas.ts`), but
 * the event `toolName` stays `edit` in every one:
 *
 *   replace     : `{ path, old_string, new_string, replace_all? }`
 *   patch       : `{ path, edits: [{ op?, rename?, diff? }] }`
 *   (cursor)    : `{ path, edits: [{ old_string, new_string }] }` (internal batch form)
 *   apply_patch : `{ input }` — `*** Begin Patch` envelope
 *   sloppy      : `{ input }` — `*** Edit File:` / `*** Find` / `*** Replace`
 *   hashline    : `{ input }` — `[PATH#TAG]` headers, `PUT`/`CUT`/`MV`/`REM` ops
 *
 * The three textual modes share the `{ input }` shape and the payload does not
 * say which is active. OMP's parsers each strip the others' framing as noise,
 * so guessing the mode from the text can be steered by a decoy line; instead
 * file headers of every grammar are collected and the raw text is scanned as a
 * whole. `_input`/`_path` are accepted because OMP may forward normalized
 * fields under those names.
 *
 * Sync point: if a mode stops matching, diff against upstream
 * `crates/pi-edit/modes/*.rs` and `edit/schemas.ts` before loosening anything.
 */
function parseEditInput(input: Record<string, unknown>): ParsedEdit {
	const text = nonEmptyString(input.input) ?? nonEmptyString(input._input);
	const siblingPath = nonEmptyString(input.path) ?? nonEmptyString(input._path);

	if (text !== undefined) {
		// Drop the BOM and the patch's terminating newline (not a body row).
		const lines = text
			.replace(/^﻿/, "")
			.replace(/\r?\n$/, "")
			.split(/\r?\n/);
		const { paths, renames } = collectTextualTargets(lines);
		// Headers in the body are authoritative; OMP's hashline falls back to
		// the `path` sibling only when the body names no file.
		if (paths.length === 0 && siblingPath !== undefined) paths.push(siblingPath);
		return { paths, renames, added: postChangeLines(lines), scanText: text };
	}

	const added: string[] = [];
	const removed: string[] = [];
	const renames: string[] = [];
	const entries = Array.isArray(input.edits) ? input.edits.filter(isRecord) : [input];
	for (const entry of entries) {
		const rename = nonEmptyString(entry.rename);
		if (rename !== undefined) renames.push(rename);
		if (typeof entry.diff === "string") collectUnifiedDiff(entry.diff, added, removed);
		if (typeof entry.new_string === "string") added.push(entry.new_string);
		if (typeof entry.old_string === "string") removed.push(entry.old_string);
	}
	return {
		paths: siblingPath !== undefined ? [siblingPath] : [],
		renames,
		added,
		scanText: [...added, ...removed].join("\n"),
	};
}

/** Patch-mode hunks: `+` lines are post-change text, `-` lines pre-change. */
function collectUnifiedDiff(diff: string, added: string[], removed: string[]): void {
	for (const line of diff.split(/\r?\n/)) {
		if (line.startsWith("+++ ") || line.startsWith("--- ")) continue;
		if (line.startsWith("+")) added.push(line.slice(1));
		else if (line.startsWith("-")) removed.push(line.slice(1));
	}
}

/** apply_patch file op / move headers (`modes/apply_patch.rs`, trimmed, case-insensitive). */
const APPLY_PATCH_FILE = /^\*{3}\s*(?:Add|Update|Delete)\s+File\s*:\s*(.+)$/i;
const APPLY_PATCH_MOVE = /^\*{3}\s*Move\s+to\s*:\s*(.+)$/i;

/** Sloppy headers — OMP's `HEADER_RE` (`modes/sloppy/parse.rs`), matched on the trimmed row. */
const SLOPPY_HEADER =
	/^\*{3}[ \t]+(Edit[ \t]+File|Find|Replace|Insert[ \t]+After|Insert[ \t]+Before)(?::|[ \t]|$)[ \t]*(.*)$/i;

/** Hashline `[PATH]` / `[PATH#TAG]` file header and `MV DEST` op (`modes/hashline/*.rs`). */
const HASHLINE_HEADER = /^\[(.*)\]$/;
const LEGACY_HASHLINE_HEADER = /^\s*¶+(.*)$/;
const HASHLINE_TAG = /#[0-9a-fA-F]{4}\s*$/;
const HASHLINE_MOVE = /^MV(?::|\s)\s*(.+)$/;
/** OMP strips apply_patch framing nested in a hashline path (`APPLY_PATCH_PATH_NOISE_RE`). */
const HASHLINE_PATH_NOISE =
	/^\*{0,3}\s*(?:(?:update|add|delete|move)[^A-Za-z0-9]*(?:file|to)?[^A-Za-z0-9]*:)?\s*\*{0,3}\s*/i;
const ENVELOPE_MARKERS = ["*** Begin Patch", "*** End Patch", "*** Abort"];

/** File and rename targets named by any textual edit grammar, in order of appearance. */
function collectTextualTargets(lines: string[]): { paths: string[]; renames: string[] } {
	const paths = new Set<string>();
	const renames = new Set<string>();
	const add = (set: Set<string>, raw: string | undefined) => {
		const path = raw === undefined ? "" : unquote(raw.trim());
		if (path.length > 0) set.add(path);
	};
	for (const line of lines) {
		const trimmed = line.trim();
		const file = APPLY_PATCH_FILE.exec(trimmed);
		if (file) {
			add(paths, file[1]);
			continue;
		}
		const move = APPLY_PATCH_MOVE.exec(trimmed) ?? HASHLINE_MOVE.exec(trimmed);
		if (move) {
			add(renames, move[1]);
			continue;
		}
		const sloppy = sloppyHeader(line);
		if (sloppy?.kind === "file") {
			add(paths, sloppy.path);
			continue;
		}
		add(paths, hashlineHeaderPath(line));
	}
	return { paths: [...paths], renames: [...renames] };
}

type SloppyHeader = { kind: "file"; path: string } | { kind: "find" } | { kind: "new" };

/** Port of OMP's sloppy `parse_header`: a bare or ` all`-suffixed `Edit File` path, or a section. */
function sloppyHeader(line: string): SloppyHeader | undefined {
	const match = SLOPPY_HEADER.exec(line.trim());
	if (!match?.[1]) return undefined;
	const name = match[1].toLowerCase();
	const rest = (match[2] ?? "").trim();
	if (name.startsWith("edit")) return { kind: "file", path: rest.replace(/(?:^|\s+)all$/i, "") };
	if (rest.length > 0) return undefined;
	return { kind: name === "find" ? "find" : "new" };
}

/** Port of OMP's hashline `parse_header_line` (trailing whitespace, nested envelope markers). */
function hashlineHeaderPath(line: string): string | undefined {
	const row = unbracketEnvelopeMarkers(line.trimEnd());
	const match = HASHLINE_HEADER.exec(row) ?? LEGACY_HASHLINE_HEADER.exec(row);
	if (match?.[1] === undefined) return undefined;
	return unquote(match[1].trim().replace(HASHLINE_TAG, "").trim()).replace(HASHLINE_PATH_NOISE, "");
}

/**
 * Port of OMP's `unbracket_envelope_markers`: `[*** Begin Patch] [a.ts#1A2B]`
 * (or unclosed `[*** Begin Patch [a.ts#1A2B]`) heads the section at `a.ts`.
 */
function unbracketEnvelopeMarkers(line: string): string {
	let rest = line;
	while (rest.startsWith("[")) {
		const inner = rest.slice(1).trimStart();
		const marker = ENVELOPE_MARKERS.find((m) => inner.startsWith(m));
		if (marker === undefined) return rest;
		let tail = inner.slice(marker.length).trimStart();
		if (tail.startsWith("]")) tail = tail.slice(1).trimStart();
		if (tail.length === 0) return marker;
		rest = tail;
	}
	return rest;
}

/**
 * Post-change text for AMSI / manifest parsing. apply_patch and hashline
 * both carry inserted text as `+`-prefixed rows; sloppy carries it as raw
 * rows under `Replace` / `Insert *` sections. Rows outside any sloppy
 * section keep the `+` rule, so a decoy sloppy header cannot hide them.
 */
function postChangeLines(lines: string[]): string[] {
	const added: string[] = [];
	let section: "find" | "new" | undefined;
	for (const line of lines) {
		const header = sloppyHeader(line);
		if (header) {
			section = header.kind === "file" ? undefined : header.kind;
			continue;
		}
		if (section === "new") added.push(line);
		else if (section === undefined && line.startsWith("+")) added.push(line.slice(1));
	}
	return added;
}

/** Strips JSON/single quotes used for spaced paths. */
function unquote(value: string): string {
	if (value.length >= 2) {
		const first = value[0];
		if (first === '"' && value.endsWith('"')) {
			try {
				const decoded: unknown = JSON.parse(value);
				if (typeof decoded === "string") return decoded;
			} catch {
				// Not valid JSON — fall through to plain quote stripping.
			}
			return value.slice(1, -1);
		}
		if (first === "'" && value.endsWith("'")) return value.slice(1, -1);
	}
	return value;
}
