/**
 * Skill ID computation — content-addressable identifier for a skill package
 * (a folder containing a `SKILL.md`).
 *
 * Algorithm:
 *  1. Walk the package directory in deterministic order (directories then
 *     files, lexicographic).
 *  2. Normalize entry paths (NFC, forward-slash, strip leading "./" / "/").
 *  3. If every entry shares a single top-level prefix, strip it (so the
 *     hash is independent of the wrapping directory name).
 *  4. Drop `skill.sig` (signature artefact).
 *  5. For each entry compute `sha256(content)` (empty buffer for dirs) then
 *     hash the sorted tuple list `(type, path, hash)\n` to produce the
 *     final skill id.
 */

import { createHash } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

export const SKIP_DIRS = new Set(["node_modules", ".git", "__pycache__"]);

function isContained(childReal: string, rootReal: string): boolean {
	return childReal === rootReal || childReal.startsWith(`${rootReal}${sep}`);
}

export interface SkillArchiveEntry {
	entryPath: string;
	isDir: boolean;
	content: Buffer;
}

export interface SkillIdResult {
	skillId: string;
	fileHashes: Record<string, string>;
}

function normalizePath(p: string): string {
	let out = p.replace(/\\/g, "/").normalize("NFC");
	out = out
		.split("/")
		.filter((c) => c !== "" && c !== ".")
		.join("/");
	while (out.startsWith("./") || out.startsWith("/")) {
		out = out.startsWith("./") ? out.slice(2) : out.slice(1);
	}
	return out;
}

/**
 * Walk `dirPath` and return its entries (directories + files) in
 * deterministic lexicographic order. Paths are relative to `dirPath`.
 */
export async function entriesFromDirectory(dirPath: string): Promise<SkillArchiveEntry[]> {
	const absDir = resolve(dirPath);
	const rootReal = await realpath(absDir);
	const entries: SkillArchiveEntry[] = [];
	const visited = new Set<string>();

	async function walk(currentPath: string): Promise<void> {
		const real = await realpath(currentPath);
		if (visited.has(real)) return;
		if (!isContained(real, rootReal)) return;
		visited.add(real);

		const items = await readdir(currentPath);
		const dirs: string[] = [];
		const files: string[] = [];

		for (const item of items) {
			const fullPath = join(currentPath, item);
			const st = await stat(fullPath);
			if (st.isDirectory()) dirs.push(item);
			else if (st.isFile()) files.push(item);
		}

		dirs.sort();
		files.sort();

		for (const d of dirs) {
			const fullPath = join(currentPath, d);
			const relPath = relative(absDir, fullPath).replace(/\\/g, "/");
			entries.push({ entryPath: relPath, isDir: true, content: Buffer.alloc(0) });
			await walk(fullPath);
		}

		for (const f of files) {
			const fullPath = join(currentPath, f);
			const fileReal = await realpath(fullPath);
			if (!isContained(fileReal, rootReal)) continue;
			const relPath = relative(absDir, fullPath).replace(/\\/g, "/");
			entries.push({
				entryPath: relPath,
				isDir: false,
				content: await readFile(fullPath),
			});
		}
	}

	await walk(absDir);
	return entries;
}

/**
 * Compute the skill id over a list of archive entries. Pure function —
 * no I/O, deterministic given the same input bytes.
 */
export function computeSkillId(entries: SkillArchiveEntry[]): SkillIdResult {
	let normalized: SkillArchiveEntry[] = entries
		.map((e) => ({ ...e, entryPath: normalizePath(e.entryPath) }))
		.filter((e) => e.entryPath !== "");

	if (normalized.length > 0) {
		const topLevel = new Set(normalized.map((e) => e.entryPath.split("/")[0]));
		if (topLevel.size === 1) {
			const prefix = `${[...topLevel][0]}/`;
			normalized = normalized
				.map((e) => ({
					...e,
					entryPath: e.entryPath.startsWith(prefix)
						? e.entryPath.slice(prefix.length)
						: e.entryPath,
				}))
				.filter((e) => e.entryPath !== "");
		}
	}

	normalized = normalized.filter((e) => e.entryPath !== "skill.sig");

	const fileHashes: Record<string, string> = {};
	const treeEntries: Array<{ type: string; entryPath: string; hash: string }> = [];

	for (const e of normalized) {
		const contentHash = createHash("sha256")
			.update(e.isDir ? Buffer.alloc(0) : e.content)
			.digest("hex");
		const entryType = e.isDir ? "dir" : "file";
		treeEntries.push({ type: entryType, entryPath: e.entryPath, hash: contentHash });
		if (!e.isDir) fileHashes[e.entryPath] = contentHash;
	}

	treeEntries.sort((a, b) => (a.entryPath < b.entryPath ? -1 : a.entryPath > b.entryPath ? 1 : 0));

	const skillHasher = createHash("sha256");
	for (const e of treeEntries) {
		skillHasher.update(Buffer.from(`${e.type}\0${e.entryPath}\0${e.hash}\n`, "utf8"));
	}

	return { skillId: skillHasher.digest("hex"), fileHashes };
}

/**
 * Walk `rootDir` recursively and return absolute paths of every directory
 * that directly contains a `SKILL.md`. Useful when scanning a plugin /
 * extension for embedded skill packages.
 *
 * - Honors {@link SKIP_DIRS} (skips `node_modules`, `.git`,
 *   `__pycache__`).
 * - Returns paths in discovery order (DFS, lexicographic).
 * - Continues into subdirectories even after a hit, so nested skill
 *   packages are discovered too.
 * - Fails-open on filesystem errors (returns whatever was found so far).
 */
export async function findSkillPackages(rootDir: string): Promise<string[]> {
	const found: string[] = [];

	let rootReal: string;
	try {
		const rootStat = await stat(rootDir);
		if (!rootStat.isDirectory()) return found;
		rootReal = await realpath(resolve(rootDir));
	} catch {
		return found;
	}

	const visited = new Set<string>();

	async function walk(dir: string): Promise<void> {
		let real: string;
		try {
			real = await realpath(dir);
		} catch {
			return;
		}
		if (visited.has(real)) return;
		if (!isContained(real, rootReal)) return;
		visited.add(real);

		let items: string[];
		try {
			items = await readdir(dir);
		} catch {
			return;
		}
		items.sort();

		if (items.includes("SKILL.md")) {
			try {
				const st = await stat(join(dir, "SKILL.md"));
				if (st.isFile()) found.push(dir);
			} catch {
				// Ignore — fail-open
			}
		}

		for (const item of items) {
			if (SKIP_DIRS.has(item)) continue;
			const fullPath = join(dir, item);
			let st: Awaited<ReturnType<typeof stat>>;
			try {
				st = await stat(fullPath);
			} catch {
				continue;
			}
			if (st.isDirectory()) {
				await walk(fullPath);
			}
		}
	}

	await walk(resolve(rootDir));
	return found;
}

/**
 * Convenience: discover + hash in one call. Returns a list of
 * `{ folder, skillId }` pairs for every skill package under `rootDir`.
 * Fails-open per skill — a single unreadable skill folder is skipped, the
 * rest still return.
 */
export async function computeSkillIdsForRoot(
	rootDir: string,
): Promise<Array<{ folder: string; skillId: string }>> {
	const folders = await findSkillPackages(rootDir);
	const out: Array<{ folder: string; skillId: string }> = [];
	for (const folder of folders) {
		try {
			const entries = await entriesFromDirectory(folder);
			const { skillId } = computeSkillId(entries);
			out.push({ folder, skillId });
		} catch {
			// Fail-open: skip this skill, keep going.
		}
	}
	return out;
}
