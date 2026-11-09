/**
 * Session-start scan: discovers what pi has loaded (extensions, packages,
 * skills) and feeds it to Sage's shared plugin scanner.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import {
	type Branding,
	discoverLooseSkillsAcrossRoots,
	type Logger,
	type PluginInfo,
	type SkillRoot,
} from "@gendigital/sage-core";
import { runHookSessionScan } from "@gendigital/sage-hook-host";
import type { PiSourceInfo } from "./pi-types.js";
import {
	getSageVersion,
	MODEL_DOWNLOAD_WORKER_PATH,
	PACKAGE_ROOT,
	PI_RUNTIME,
	SKILL_UPLOAD_WORKER_PATH,
	THREATS_DIR,
	TRUSTED_DOMAINS_DIR,
} from "./runtime.js";

const isSynthetic = (p: string): boolean => p.startsWith("builtin:") || p.startsWith("<");

/** Walk from `cwd` up to the repo root (first dir containing `.git`) or the filesystem root. */
function ancestorsToRepoRoot(cwd: string): string[] {
	const dirs: string[] = [];
	let dir = resolve(cwd);
	for (;;) {
		dirs.push(dir);
		if (existsSync(join(dir, ".git"))) break;
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return dirs;
}

/** pi's personal and project skill roots, plus the shared `.agents/skills` convention. */
export function resolveSkillRoots(agentDir: string, cwd: string): SkillRoot[] {
	const roots: SkillRoot[] = [
		{ dir: join(agentDir, "skills"), tag: "pi", scope: "personal" },
		{ dir: join(homedir(), ".agents", "skills"), tag: "agents", scope: "personal" },
		{ dir: join(cwd, ".pi", "skills"), tag: "pi", scope: "project" },
	];
	for (const dir of ancestorsToRepoRoot(cwd)) {
		roots.push({ dir: join(dir, ".agents", "skills"), tag: "agents", scope: "project" });
	}
	return roots;
}

function isInside(child: string, parent: string): boolean {
	const c = resolve(child);
	const p = resolve(parent);
	return c === p || c.startsWith(p + sep);
}

/** Turn pi's loaded-resource sources into scannable plugins (excluding Sage itself). */
export function pluginsFromSources(
	sources: PiSourceInfo[],
	selfRoot: string = PACKAGE_ROOT,
): PluginInfo[] {
	const byPath = new Map<string, PluginInfo>();
	for (const s of sources) {
		if (!s?.path || isSynthetic(s.path)) continue;
		const installPath = s.origin === "package" && s.baseDir ? s.baseDir : s.path;
		if (isSynthetic(installPath) || isInside(installPath, selfRoot) || byPath.has(installPath)) {
			continue;
		}
		try {
			const stats = statSync(installPath);
			let name = basename(installPath).replace(/\.(ts|js|mjs|cjs)$/, "");
			let version = `local-${Math.round(stats.mtimeMs)}`;
			if (stats.isDirectory()) {
				try {
					const pkg = JSON.parse(readFileSync(join(installPath, "package.json"), "utf-8"));
					if (typeof pkg.name === "string") name = pkg.name;
					if (typeof pkg.version === "string") version = pkg.version;
				} catch {
					// no package.json — keep directory name
				}
			}
			byPath.set(installPath, {
				key: `${s.scope}/${name}@${version}`,
				installPath,
				version,
				lastUpdated: stats.mtime.toISOString(),
			});
		} catch {
			// vanished or unreadable — skip
		}
	}
	return [...byPath.values()];
}

export interface SessionScanInput {
	logger: Logger;
	branding: Branding;
	agentDir: string;
	cwd: string;
	sources: PiSourceInfo[];
	agentRuntimeVersion?: string;
}

/** Runs the scan; returns user-facing messages (empty when nothing to say). */
export async function runSessionScan(input: SessionScanInput): Promise<string[]> {
	const plugins = [
		...pluginsFromSources(input.sources),
		...(await discoverLooseSkillsAcrossRoots(resolveSkillRoots(input.agentDir, input.cwd))),
	];

	return runHookSessionScan({
		logger: input.logger,
		branding: input.branding,
		agentRuntime: PI_RUNTIME,
		agentRuntimeVersion: input.agentRuntimeVersion,
		version: getSageVersion(),
		plugins,
		threatsDir: THREATS_DIR,
		trustedDomainsDir: TRUSTED_DOMAINS_DIR,
		modelDownloadWorkerPath: MODEL_DOWNLOAD_WORKER_PATH,
		skillUploadWorkerPath: SKILL_UPLOAD_WORKER_PATH,
	});
}
