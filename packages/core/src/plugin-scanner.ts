/**
 * Plugin scanner — discovers and scans installed Claude Code plugins.
 *
 * The scanner runs four checks per plugin:
 *
 *   - URL reputation (Avast) on every URL extracted from plugin files.
 *   - File-hash reputation (Avast) on every scannable file's sha256.
 *   - AMSI scan on file content when an `AmsiClient` is supplied
 *     (Windows-only; caller owns lifecycle).
 *   - Skill-package risk lookup on any folder containing `SKILL.md`.
 *
 * The scanner intentionally does NOT run shell-flavored regex heuristics
 * over plugin source. That stage was removed because it produced
 * substring-match false positives across nearly every Python/JS/TS
 * plugin (e.g. `compat.exec(…)` matching the literal `at\.exe`) without
 * catching anything that the URL/hash/AMSI/skill checks don't already
 * cover. The runtime evaluator still applies the regex threats to actual
 * tool calls — they just no longer fire on plugin source-code text.
 */

import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import type { AmsiClient } from "./clients/amsi.js";
import { FileCheckClient } from "./clients/file-check.js";
import { SkillCheckClient } from "./clients/skill-check.js";
import { UrlCheckClient } from "./clients/url-check.js";
import { getClaudeConfigDir } from "./config.js";
import { extractUrls } from "./extractors.js";
import { getFileContent, getFileContentRaw, getFileContentSync } from "./file-utils.js";
import { computeSkillIdsForRoot, SKIP_DIRS } from "./skill-id.js";
import type { Logger, PluginFinding, PluginInfo, PluginScanResult } from "./types.js";
import { nullLogger } from "./types.js";

function defaultPluginsRegistry(): string {
	return join(getClaudeConfigDir(), "plugins", "installed_plugins.json");
}

/**
 * Extensions whose contents are read from disk and fed to the URL-
 * reputation, AMSI, and file-hash checks. Files outside this set are
 * skipped entirely (no read, no checks).
 */
const SCANNABLE_EXTENSIONS = new Set([
	".py",
	".js",
	".ts",
	".mjs",
	".mts",
	".sh",
	".bash",
	".zsh",
	".json",
	".yaml",
	".yml",
	".md",
	".toml",
	".txt",
	".cfg",
	".ini",
	".conf",
]);

/** Max file size to scan (skip large files). */
const MAX_FILE_SIZE = 512 * 1024;

/**
 * Sync check: is a plugin name present in the Claude Code plugin registry?
 * Returns true (found), false (not found), or null (registry unreadable).
 */
export function isPluginInstalledSync(pluginName: string): boolean | null {
	let raw: string;
	try {
		raw = getFileContentSync(defaultPluginsRegistry());
	} catch (err: unknown) {
		if (
			err &&
			typeof err === "object" &&
			"code" in err &&
			(err as { code: string }).code === "ENOENT"
		) {
			return false;
		}
		return null;
	}
	try {
		const data = JSON.parse(raw) as Record<string, unknown>;
		const plugins = (data.plugins ?? {}) as Record<string, unknown>;
		return Object.keys(plugins).some((key) => {
			const lastAt = key.lastIndexOf("@");
			const name = lastAt > 0 ? key.substring(0, lastAt) : key;
			return name === pluginName;
		});
	} catch {
		return null;
	}
}

export async function discoverPlugins(
	registryPath = defaultPluginsRegistry(),
	logger: Logger = nullLogger,
): Promise<PluginInfo[]> {
	let raw: string;
	try {
		raw = await getFileContent(registryPath);
	} catch {
		logger.debug("Plugin registry not found", { path: registryPath });
		return [];
	}

	let data: Record<string, unknown>;
	try {
		data = JSON.parse(raw) as Record<string, unknown>;
	} catch (e) {
		logger.warn("Failed to read plugin registry", { error: String(e) });
		return [];
	}

	const plugins: PluginInfo[] = [];
	const pluginEntries = (data.plugins ?? {}) as Record<string, unknown>;

	for (const [pluginKey, versions] of Object.entries(pluginEntries)) {
		if (!Array.isArray(versions) || versions.length === 0) continue;
		const entry = versions[versions.length - 1] as Record<string, unknown>;
		const installPath = (entry.installPath ?? "") as string;
		const version = (entry.version ?? "unknown") as string;
		const lastUpdated = (entry.lastUpdated ?? "") as string;

		if (!installPath) continue;

		plugins.push({ key: pluginKey, installPath, version, lastUpdated });
	}

	return plugins;
}

async function walkPluginFiles(installPath: string, logger: Logger): Promise<string[]> {
	const files: string[] = [];

	async function walk(dirOrFile: string): Promise<void> {
		let stats: Awaited<ReturnType<typeof stat>>;
		try {
			stats = await stat(dirOrFile);
		} catch {
			return;
		}
		if (stats.isFile()) {
			if (
				SCANNABLE_EXTENSIONS.has(extname(dirOrFile).toLowerCase()) &&
				stats.size <= MAX_FILE_SIZE
			) {
				files.push(dirOrFile);
			}
			return;
		}
		if (stats.isDirectory()) {
			let entries: string[];
			try {
				entries = await readdir(dirOrFile);
			} catch {
				return;
			}
			for (const entry of entries) {
				if (SKIP_DIRS.has(entry)) continue;
				const fullPath = join(dirOrFile, entry);
				await walk(fullPath);
			}
		}
	}
	try {
		await walk(installPath);
	} catch (e) {
		logger.warn(`Error walking plugin path ${installPath}`, { error: String(e) });
	}
	return files;
}

export async function scanPlugin(
	plugin: PluginInfo,
	options: {
		checkUrls?: boolean;
		checkFileHashes?: boolean;
		checkSkills?: boolean;
		/** Pre-initialized AMSI client, or null if AMSI is unavailable. Caller owns lifecycle. */
		amsiClient?: AmsiClient | null;
		logger?: Logger;
	} = {},
): Promise<PluginScanResult> {
	const {
		checkUrls = true,
		checkFileHashes = true,
		checkSkills = true,
		amsiClient = null,
		logger = nullLogger,
	} = options;
	const result: PluginScanResult = { plugin, findings: [] };

	// Skill check is independent of the file walk — runs in parallel and
	// uses its own enumeration via `computeSkillIdsForRoot`.
	const skillCheckPromise = checkSkills
		? runSkillCheck(plugin, result.findings, logger)
		: Promise.resolve();

	const files = await walkPluginFiles(plugin.installPath, logger);
	if (files.length === 0) {
		await skillCheckPromise;
		return result;
	}

	const allUrls: string[] = [];
	const hashToFiles = new Map<string, string[]>();

	for (const filePath of files) {
		let content: string;
		let rawBytes: Buffer;
		try {
			rawBytes = await getFileContentRaw(filePath);
			content = rawBytes.toString("utf-8");
		} catch {
			continue;
		}

		// AMSI scan (Windows)
		if (amsiClient) {
			try {
				const scanName = `${plugin.key}/${relative(plugin.installPath, filePath)}`;
				const amsiResult = await amsiClient.scanString("Plugin", scanName, content);
				if (amsiResult && (amsiResult.isDetected || amsiResult.isBlockedByAdmin)) {
					result.findings.push({
						threatId: "AMSI_SCAN",
						title: `AMSI detection (result=${amsiResult.amsiResult})`,
						severity: "critical",
						confidence: 1.0,
						action: "block",
						artifact: content.slice(0, 200),
						sourceFile: relative(plugin.installPath, filePath),
					});
				}
			} catch {
				// Fail open
			}
		}

		if (checkUrls) {
			allUrls.push(...extractUrls(content));
		}

		if (checkFileHashes) {
			const sha256 = createHash("sha256").update(rawBytes).digest("hex");
			const existing = hashToFiles.get(sha256);
			if (existing) {
				existing.push(filePath);
			} else {
				hashToFiles.set(sha256, [filePath]);
			}
		}
	}

	const urlCheckPromise =
		checkUrls && allUrls.length > 0
			? (async () => {
					try {
						const uniqueUrls = [...new Set(allUrls)];
						const client = new UrlCheckClient();
						const checkResults = await client.checkUrls(uniqueUrls);
						for (const ur of checkResults) {
							if (ur.isMalicious) {
								const findingDetails = ur.findings
									.map((f) => `${f.severityName}/${f.typeName}`)
									.join(", ");
								result.findings.push({
									threatId: "URL_CHECK",
									title: `Malicious URL (${findingDetails})`,
									severity: "critical",
									confidence: 1.0,
									action: "block",
									artifact: ur.url.slice(0, 200),
									sourceFile: "URL check",
								});
							}
						}
					} catch {
						// Fail open
					}
				})()
			: Promise.resolve();

	const fileCheckPromise =
		checkFileHashes && hashToFiles.size > 0
			? (async () => {
					try {
						const client = new FileCheckClient();
						const uniqueHashes = [...hashToFiles.keys()];
						const checkResults = await client.checkHashes(uniqueHashes);
						for (const fr of checkResults) {
							if (fr.severity === "SEVERITY_MALWARE") {
								const filePaths = hashToFiles.get(fr.sha256) ?? [];
								for (const filePath of filePaths) {
									result.findings.push({
										threatId: "FILE_CHECK",
										title: `Malicious file (${fr.detectionNames.join(", ") || "unknown"})`,
										severity: "critical",
										confidence: 1.0,
										action: "block",
										artifact: fr.sha256,
										sourceFile: relative(plugin.installPath, filePath),
									});
								}
							}
						}
					} catch {
						// Fail open
					}
				})()
			: Promise.resolve();

	await Promise.all([urlCheckPromise, fileCheckPromise, skillCheckPromise]);

	return result;
}

async function runSkillCheck(
	plugin: PluginInfo,
	findings: PluginFinding[],
	logger: Logger,
): Promise<void> {
	try {
		const skills = await computeSkillIdsForRoot(plugin.installPath);
		if (skills.length === 0) return;

		const ids = skills.map((s) => s.skillId);
		const client = new SkillCheckClient(undefined, logger);
		const verdicts = await client.checkSkills(ids);

		for (const { folder, skillId } of skills) {
			const verdict = verdicts.get(skillId);
			if (!verdict) continue;
			const risk = (verdict.overallRiskLevel ?? "").toUpperCase();
			if (risk !== "HIGH" && risk !== "CRITICAL") continue;

			const severity = risk === "CRITICAL" ? "critical" : "high";
			findings.push({
				threatId: "SKILL_CHECK",
				title: verdict.summary?.trim() || `Risky skill detected (${risk})`,
				severity,
				confidence: 1.0,
				action: "log",
				artifact: skillId.slice(0, 16),
				sourceFile: relative(plugin.installPath, folder) || ".",
				recommendations: verdict.recommendations.length > 0 ? verdict.recommendations : undefined,
			});
		}
	} catch (e) {
		logger.debug("Skill check failed", { error: String(e) });
	}
}
