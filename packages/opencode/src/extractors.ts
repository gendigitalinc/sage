/**
 * OpenCode tool input extraction mapped onto @gendigital/sage-core artifact extractors.
 *
 * Covers both host generations: v1 tools (`bash`, camelCase `filePath`) and v2
 * tools (`shell`, `patch`, `subagent`, `path` for file tools).
 */

import {
	type Artifact,
	extractFromBash,
	extractFromEdit,
	extractFromWebFetch,
	extractFromWrite,
	extractUrls,
	MAX_CONTENT_SIZE,
} from "@gendigital/sage-core";

function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
	return typeof value === "number" ? value : undefined;
}

/**
 * File path arguments, deduplicated: v2 uses `path`, v1 uses `filePath`. The
 * v2 key comes first. A payload carrying both (malformed, adversarial or
 * host-transformed) yields both, so every path the tool might act on gets
 * evaluated instead of Sage guessing which one the host will use.
 */
function openCodeFilePaths(args: Record<string, unknown>): string[] {
	const paths: string[] = [];
	for (const value of [asString(args.path), asString(args.filePath)]) {
		if (value && !paths.includes(value)) paths.push(value);
	}
	return paths;
}

/** Primary file path argument (`path` on v2, `filePath` on v1). */
export function openCodeFilePath(args: Record<string, unknown>): string {
	return openCodeFilePaths(args)[0] ?? "";
}

/** Append artifacts for any secondary file path in an ambiguous payload. */
function withAlternatePaths(
	artifacts: Artifact[],
	args: Record<string, unknown>,
	context: string,
): Artifact[] {
	for (const value of openCodeFilePaths(args).slice(1)) {
		artifacts.push({ type: "file_path", value, context });
	}
	return artifacts;
}

/**
 * Extract artifacts from a v2 `patch` call. `patchText` uses the
 * `*** Begin Patch` envelope with Add/Update/Delete File headers and
 * optional `*** Move to:` / `*** Rename File:` renames (`old -> new` emits
 * both paths).
 */
function extractFromPatch(patchText: string): Artifact[] | null {
	if (!patchText) return null;
	const artifacts: Artifact[] = [];
	for (const match of patchText.matchAll(/\*{3}\s+(?:Add|Update|Delete)\s+File:\s*(.+)/g)) {
		const filePath = match[1]?.trim();
		if (filePath) artifacts.push({ type: "file_path", value: filePath, context: "edit" });
	}
	for (const match of patchText.matchAll(/\*{3}\s+(?:Move\s+to|Rename\s+File):\s*(.+)/gi)) {
		const raw = match[1]?.trim() ?? "";
		const arrow = raw.indexOf(" -> ");
		const targets = arrow === -1 ? [raw] : [raw.slice(0, arrow), raw.slice(arrow + 4)];
		for (const target of targets) {
			const filePath = target.trim();
			if (filePath) artifacts.push({ type: "file_path", value: filePath, context: "edit" });
		}
	}
	const capped = patchText.slice(0, MAX_CONTENT_SIZE);
	for (const url of extractUrls(capped)) {
		artifacts.push({ type: "url", value: url, context: "from_edit_content" });
	}
	if (capped.trim()) artifacts.push({ type: "content", value: capped, context: "edit" });
	return artifacts.length > 0 ? artifacts : null;
}

/** Both aliases may be present in a malformed or host-transformed call. */
export function openCodePatchTexts(args: Record<string, unknown>): string[] {
	const patches: string[] = [];
	for (const value of [asString(args.patchText), asString(args.patch)]) {
		if (value !== undefined && !patches.includes(value)) patches.push(value);
	}
	return patches;
}

export function extractFromOpenCodeTool(
	toolName: string,
	args: Record<string, unknown>,
): Artifact[] | null {
	switch (toolName) {
		case "bash":
		case "shell": {
			const command = asString(args.command) ?? "";
			return command ? extractFromBash(command) : null;
		}
		case "webfetch": {
			const url = asString(args.url) ?? "";
			return url ? extractFromWebFetch({ url }) : null;
		}
		case "write": {
			const filePath = openCodeFilePath(args);
			if (!filePath) return null;
			return withAlternatePaths(
				extractFromWrite({ file_path: filePath, content: asString(args.content) ?? "" }),
				args,
				"write",
			);
		}
		case "edit": {
			const filePath = openCodeFilePath(args);
			if (!filePath) return null;
			return withAlternatePaths(
				extractFromEdit({
					file_path: filePath,
					old_string: asString(args.oldString) ?? "",
					new_string: asString(args.newString) ?? "",
				}),
				args,
				"edit",
			);
		}
		case "read": {
			const filePath = openCodeFilePath(args);
			if (!filePath) return null;
			return withAlternatePaths(
				[{ type: "file_path", value: filePath, context: "read" }],
				args,
				"read",
			);
		}
		case "glob": {
			const pattern = asString(args.pattern) ?? "";
			if (!pattern) return null;
			return [{ type: "file_path", value: pattern, context: "glob_pattern" }];
		}
		case "grep": {
			const pattern = asString(args.pattern) ?? "";
			if (!pattern) return null;
			const artifacts: Artifact[] = [{ type: "content", value: pattern, context: "grep_pattern" }];
			const include = asString(args.include);
			if (include) {
				artifacts.push({ type: "file_path", value: include, context: "grep_include" });
			}
			return artifacts;
		}
		case "ls": {
			const dir = asString(args.path) ?? asString(args.directoryPath) ?? "";
			if (!dir) return null;
			return [{ type: "file_path", value: dir, context: "list" }];
		}
		case "codesearch": {
			const query = asString(args.query) ?? "";
			return query ? [{ type: "content", value: query, context: "codesearch_query" }] : null;
		}
		case "websearch": {
			const query = asString(args.query) ?? "";
			return query ? [{ type: "content", value: query, context: "websearch_query" }] : null;
		}
		case "question": {
			const selected = Array.isArray(args.selected) ? args.selected : [];
			const joined = selected
				.map((item) => (typeof item === "string" ? item : null))
				.filter((item): item is string => item !== null)
				.join("\n");
			if (!joined) return null;
			return [{ type: "content", value: joined, context: "question_options" }];
		}
		case "patch": {
			const artifacts = openCodePatchTexts(args).flatMap((value) => extractFromPatch(value) ?? []);
			return artifacts.length > 0 ? artifacts : null;
		}
		case "task":
		case "subagent": {
			const prompt = asString(args.prompt) ?? "";
			const desc = asString(args.description) ?? "";
			const payload = [desc, prompt].filter(Boolean).join("\n\n");
			return payload ? [{ type: "content", value: payload, context: "task" }] : null;
		}
		case "read_lines": {
			const filePath = openCodeFilePath(args);
			if (!filePath) return null;
			const offset = asNumber(args.offset);
			const limit = asNumber(args.limit);
			return withAlternatePaths(
				[
					{
						type: "file_path",
						value: `${filePath}:${offset ?? 1}:${limit ?? 0}`,
						context: "read_lines",
					},
				],
				args,
				"read_lines",
			);
		}
		default:
			return null;
	}
}
