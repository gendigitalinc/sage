/**
 * Maps pi tool inputs to sage artifacts.
 *
 * Schemas verified against pi 1.3.0 (`core/tools/*.ts`). Handlers receive
 * arguments after `prepareArguments` and schema validation, so `edit` always
 * arrives as `{ path, edits: [{ oldText, newText }] }` — legacy top-level
 * fields and stringified `edits` are already folded in.
 *
 * Coverage policy: every built-in tool that can execute code, read or write
 * files, search, or open a URL emits at least one artifact, so a search of
 * `~/.ssh` or a fetch of a deny-listed URL is never a silent allow. Codemode
 * scripts run sandboxed and the tools they call fire their own `tool_call`
 * events, so they are evaluated there.
 */

import { homedir } from "node:os";
import { resolve } from "node:path";
import {
	type Artifact,
	type CanonicalToolType,
	canonicalizeToolName,
	extractFromBash,
	extractFromEdit,
	extractFromRead,
	extractFromWebFetch,
	extractFromWrite,
	extractUrls,
} from "@gendigital/sage-core";
import type { HookToolMapping } from "@gendigital/sage-hook-host";

/**
 * Resolve a path the way pi's tools do: strip `@`, expand `~`, resolve against
 * cwd. File-path rules match absolute locations, so evaluating the raw string
 * would let a relative or home-relative path to a protected file miss them.
 * Non-breaking spaces are normalized because pi does the same.
 */
export function resolvePiPath(p: string, cwd: string | undefined): string {
	let s = p.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ");
	if (s.startsWith("@")) s = s.slice(1);
	if (s === "~") s = homedir();
	else if (s.startsWith("~/") || s.startsWith("~\\")) s = homedir() + s.slice(1);
	// Without a cwd (headless callers, older hosts) keep the expanded path as-is
	// rather than resolving against the extension's own process directory.
	return cwd ? resolve(cwd, s) : s;
}

/**
 * Raw pi tool name → canonical label. Pinned by the tool-names contract
 * fixture; a rename or a new guarded tool is a conscious fixture update.
 */
export const PI_TOOL_MAP: Record<string, CanonicalToolType> = {
	bash: "Bash",
	powershell: "Bash",
	write: "Write",
	edit: "Edit",
	read: "Read",
	grep: "Grep",
	find: "Glob",
	ls: "List",
	web_search: "WebSearch",
	url_context: "WebFetch",
};

/**
 * Translate a pi tool call into the artifacts sage evaluates, the canonical
 * `toolInput` keys core reads, and the canonical tool label. Rule matching
 * keys off `match_on` (command/file_path/url/content), not the label, so the
 * label only affects audit/telemetry. Unknown tools emit no artifacts and pass
 * their input through: the handler short-circuits before the shape matters.
 *
 * SIBLING: `packages/omp/src/extractors.ts` is the parallel mapper for OMP.
 * The two intentionally differ (OMP's edit modes are far richer), but fixes to
 * a shared concern — URL extraction, package/manifest handling, the canonical
 * keys — should be mirrored there.
 */
export function mapToolCall(
	toolName: string,
	input: Record<string, unknown>,
	cwd?: string,
): HookToolMapping {
	const pathOf = (value: unknown): string => {
		const raw = stringOrEmpty(value);
		return raw ? resolvePiPath(raw, cwd) : "";
	};
	// `ls`/`grep`/`find` list the session cwd when `path` is omitted. Emitting
	// nothing made `ls {}` a silent allow while `ls {path: "."}` was evaluated.
	const searchPathOf = (value: unknown): string => pathOf(value) || (cwd ? resolve(cwd) : "");
	switch (toolName) {
		case "bash":
		case "powershell": {
			// pi's powershell tool shares bash's `{ command, timeout? }` schema.
			const command = stringOrEmpty(input.command);
			return {
				toolName: "Bash",
				toolInput: { command },
				artifacts: command.length > 0 ? extractFromBash(command) : [],
			};
		}
		case "write": {
			const toolInput = {
				file_path: pathOf(input.path),
				content: stringOrEmpty(input.content),
			};
			return { toolName: "Write", toolInput, artifacts: extractFromWrite(toolInput) };
		}
		case "edit": {
			const file_path = pathOf(input.path);
			const { added, removed } = collectEditText(input);
			return {
				toolName: "Edit",
				toolInput: { file_path, new_string: added.join("\n") },
				// Pre-change text is scanned too: URLs in removed content may still be
				// attacker-controlled supply-chain text the agent was asked to touch.
				artifacts: extractFromEdit({ file_path, new_string: [...added, ...removed].join("\n") }),
			};
		}
		case "read": {
			const toolInput = { file_path: pathOf(input.path) };
			return { toolName: "Read", toolInput, artifacts: extractFromRead(toolInput) };
		}
		case "grep":
			return mapGrep(input, searchPathOf);
		case "find":
			return mapFind(input, searchPathOf);
		case "ls":
			return mapLs(input, searchPathOf);
		case "web_search":
			return mapWebSearch(input);
		case "url_context":
			return mapUrlContext(input);
		case "gui_targets": {
			return { toolName: "Unknown", toolInput: input, artifacts: [] };
		}
		case "gui_act": {
			const artifacts: Artifact[] = [];
			const action = input.action;
			if (action && typeof action === "object") {
				const actionObj = action as Record<string, unknown>;
				if (actionObj.kind === "set_text" && typeof actionObj.text === "string") {
					const urls = extractUrls(actionObj.text);
					for (const url of urls) {
						artifacts.push({ type: "url", value: url });
					}
				}
			}
			return { toolName: "Unknown", toolInput: input, artifacts };
		}
		default:
			return {
				toolName: canonicalizeToolName(PI_TOOL_MAP, toolName),
				toolInput: input,
				artifacts: [],
			};
	}
}

function mapped(
	toolName: CanonicalToolType,
	toolInput: Record<string, unknown>,
	artifacts: Artifact[],
): HookToolMapping {
	return { toolName, toolInput, artifacts };
}

type PathOf = (value: unknown) => string;

/**
 * `grep`: pattern is content; path and glob are file paths the search touches.
 * An omitted `path` means the session cwd, which `pathOf` resolves.
 */
function mapGrep(input: Record<string, unknown>, pathOf: PathOf): HookToolMapping {
	const pattern = stringOrEmpty(input.pattern);
	const path = pathOf(input.path);
	// `glob` is a filter pattern, not a location, so it is not resolved.
	const glob = stringOrEmpty(input.glob);
	const artifacts: Artifact[] = [];
	if (pattern) artifacts.push({ type: "content", value: pattern, context: "grep_pattern" });
	if (path) artifacts.push({ type: "file_path", value: path, context: "grep_path" });
	if (glob) artifacts.push({ type: "file_path", value: glob, context: "grep_include" });
	return mapped("Grep", { pattern, path, glob }, artifacts);
}

/**
 * `find`: pi's glob search. The pattern is the thing being enumerated; an
 * omitted `path` means the session cwd, which `pathOf` resolves.
 */
function mapFind(input: Record<string, unknown>, pathOf: PathOf): HookToolMapping {
	const pattern = stringOrEmpty(input.pattern);
	const path = pathOf(input.path);
	const artifacts: Artifact[] = [];
	if (pattern) artifacts.push({ type: "file_path", value: pattern, context: "glob_pattern" });
	if (path) artifacts.push({ type: "file_path", value: path, context: "glob_path" });
	return mapped("Glob", { pattern, path }, artifacts);
}

/**
 * `ls`: the directory being listed. An omitted path means the session cwd,
 * which `pathOf` resolves so listing it is still evaluated.
 */
function mapLs(input: Record<string, unknown>, pathOf: PathOf): HookToolMapping {
	const path = pathOf(input.path);
	const artifacts: Artifact[] = path ? [{ type: "file_path", value: path, context: "list" }] : [];
	return mapped("List", { path }, artifacts);
}

/** pi-web-search `web_search`: the query is content, same as OpenCode's websearch. */
function mapWebSearch(input: Record<string, unknown>): HookToolMapping {
	const query = stringOrEmpty(input.query);
	const artifacts: Artifact[] = [];
	if (query) {
		artifacts.push({ type: "content", value: query, context: "websearch_query" });
		// A query can carry a full URL (e.g. "summarize https://evil.test/x").
		// Surface each as a URL artifact so a deny-listed domain in the query
		// blocks, matching how url_context / WebFetch are treated.
		for (const url of extractUrls(query)) {
			artifacts.push({ type: "url", value: url, context: "websearch_url" });
		}
	}
	return mapped("WebSearch", { query }, artifacts);
}

/**
 * pi-web-search `url_context`: fetches `urls[]` (some builds send a single
 * `url`). Each entry is a WebFetch artifact, so a deny-listed URL blocks.
 */
function mapUrlContext(input: Record<string, unknown>): HookToolMapping {
	const listed = Array.isArray(input.urls) ? input.urls : [];
	const urls = [
		...listed.filter((entry): entry is string => typeof entry === "string" && entry.length > 0),
		...(typeof input.url === "string" && input.url.length > 0 ? [input.url] : []),
	];
	const artifacts = urls.flatMap((url) => extractFromWebFetch({ url }));
	// `url` is the first entry so core's audit summary (which reads `toolInput.url`)
	// records something without a core change. The pre-tool PI scan still covers
	// only that first URL (core WebFetch pre-scan is first-url-only; the
	// multi-URL scan was reverted from this PR). Every URL
	// is still a url artifact, so reputation and heuristics see them all, and
	// `tool_result` scans the fetched output. See the README.
	return mapped("WebFetch", { urls, ...(urls[0] ? { url: urls[0] } : {}) }, artifacts);
}

function stringOrEmpty(value: unknown): string {
	return typeof value === "string" ? value : "";
}

/** Splits `edits[]` into replacement (`newText`) and anchor (`oldText`) text. */
function collectEditText(input: Record<string, unknown>): { added: string[]; removed: string[] } {
	const added: string[] = [];
	const removed: string[] = [];
	if (!Array.isArray(input.edits)) return { added, removed };
	for (const raw of input.edits) {
		if (!raw || typeof raw !== "object") continue;
		const entry = raw as Record<string, unknown>;
		if (typeof entry.newText === "string") added.push(entry.newText);
		if (typeof entry.oldText === "string") removed.push(entry.oldText);
	}
	return { added, removed };
}
