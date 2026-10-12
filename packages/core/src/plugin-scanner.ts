/**
 * Plugin scanner — discovers and scans installed Claude Code plugins.
 *
 * The scanner runs four checks per plugin:
 *
 *   - URL reputation (configured reputation API) on every URL extracted from plugin files.
 *   - File-hash reputation (configured reputation API) on every scannable file's sha256.
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
import { readdir, realpath, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { logSkillQueued } from "./audit-log.js";
import type { AmsiClient } from "./clients/amsi.js";
import { FileCheckClient } from "./clients/file-check.js";
import { SkillCheckClient } from "./clients/skill-check.js";
import { UrlCheckClient } from "./clients/url-check.js";
import { getClaudeConfigDir } from "./config.js";
import { extractUrls } from "./extractors.js";
import { getFileContent, getFileContentRaw, getFileContentSync } from "./file-utils.js";
import { computeSkillIdsForRoot, isContained, SKIP_DIRS } from "./skill-id.js";
import {
	addPending,
	isPending,
	loadPendingMarker,
	removePending,
	savePendingMarker,
} from "./skill-pending.js";
import { getVerdict, loadSkillVerdictCache, saveSkillVerdictCache } from "./skill-verdict-cache.js";
import { type RecordedSkillVerdict, recordAnalyzedSkillVerdict } from "./skill-verdict-record.js";
import type {
	Logger,
	LoggingConfig,
	PluginFinding,
	PluginInfo,
	PluginScanResult,
} from "./types.js";
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

export async function walkPluginFiles(installPath: string, logger: Logger): Promise<string[]> {
	const files: string[] = [];
	const visited = new Set<string>();

	let rootReal: string;
	try {
		rootReal = await realpath(resolve(installPath));
	} catch (e) {
		logger.warn(`Error walking plugin path ${installPath}`, { error: String(e) });
		return files;
	}

	async function walk(dirOrFile: string): Promise<void> {
		let real: string;
		try {
			real = await realpath(dirOrFile);
		} catch {
			return;
		}
		if (visited.has(real)) return;
		if (!isContained(real, rootReal)) return;
		visited.add(real);

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
		await walk(resolve(installPath));
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
		/** Override the skill verdict cache path (tests); defaults to ~/.sage. */
		skillVerdictCachePath?: string;
		/** Override the skill pending marker path (tests); defaults to ~/.sage. */
		skillPendingPath?: string;
		loggingConfig?: LoggingConfig;
		/** How long a cached skill verdict is trusted, in ms. */
		skillVerdictTtlMs?: number;
		/** Upload unknown skills for deep analysis. When false, lookup-only. Defaults to true. */
		uploadEnabled?: boolean;
		/**
		 * One-time notice session: when true and `uploadEnabled` is false, an
		 * unknown skill is not queued (grace) but the plugin's scan cache is
		 * deferred so the next session (uploads active) re-scans and queues it.
		 * Distinguishes grace from stable lookup-only mode, which caches as usual.
		 */
		deferUnknownSkills?: boolean;
		/** Agent runtime running this scan (e.g. "cursor"); recorded as skill verdict origin. */
		agentRuntime?: string;
	} = {},
): Promise<PluginScanResult> {
	const {
		checkUrls = true,
		checkFileHashes = true,
		checkSkills = true,
		amsiClient = null,
		logger = nullLogger,
		skillVerdictCachePath,
		skillPendingPath,
		loggingConfig,
		skillVerdictTtlMs,
		uploadEnabled = true,
		deferUnknownSkills = false,
		agentRuntime,
	} = options;
	const result: PluginScanResult = { plugin, findings: [] };

	// Skill check is independent of the file walk — runs in parallel and
	// uses its own enumeration via `computeSkillIdsForRoot`.
	const skillCheckPromise: Promise<boolean> = checkSkills
		? runSkillCheck(plugin, result.findings, logger, {
				verdictCachePath: skillVerdictCachePath,
				pendingPath: skillPendingPath,
				loggingConfig,
				verdictTtlMs: skillVerdictTtlMs,
				uploadEnabled,
				deferUnknownSkills,
				agentRuntime,
			})
		: Promise.resolve(false);

	const files = await walkPluginFiles(plugin.installPath, logger);
	if (files.length === 0) {
		if (await skillCheckPromise) result.deferCache = true;
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

	const [, , skillDeferCache] = await Promise.all([
		urlCheckPromise,
		fileCheckPromise,
		skillCheckPromise,
	]);
	if (skillDeferCache) result.deferCache = true;

	return result;
}

/** Common shape of a skill verdict from either the live lookup or the cache. */
interface SkillVerdictLike {
	jobId?: string;
	verdict?: string;
	summary?: string;
}

/** Push a SKILL_CHECK finding when the verdict's risk is HIGH or CRITICAL. */
function pushSkillFindingIfRisky(
	findings: PluginFinding[],
	plugin: PluginInfo,
	skillId: string,
	folder: string,
	verdict: SkillVerdictLike,
): void {
	const risk = (verdict.verdict ?? "").toUpperCase();
	if (risk !== "HIGH" && risk !== "CRITICAL") return;

	const severity = risk === "CRITICAL" ? "critical" : "warning";
	findings.push({
		threatId: "SKILL_CHECK",
		title:
			verdict.summary?.trim() ||
			(risk === "CRITICAL" ? "Malicious skill detected" : "Suspicious skill detected"),
		severity,
		artifact: skillId.slice(0, 16),
		sourceFile: relative(plugin.installPath, folder) || ".",
	});
}

/**
 * Skill-package risk check, in two phases:
 *
 *  1. Resolve each skill from the persistent verdict cache (no network) — a
 *     cache hit yields a finding for risky skills and is skipped otherwise.
 *  2. For skills not in the cache, look them up by content-addressed id. A known
 *     verdict (or explicit clean) is cached; a skill the server has never seen
 *     (absent from the response) is queued in the pending marker for the
 *     detached upload worker (Phase 2), deduped so it is submitted only once.
 *
 * Fail-open throughout: any error leaves findings untouched.
 */
async function runSkillCheck(
	plugin: PluginInfo,
	findings: PluginFinding[],
	logger: Logger,
	paths: {
		verdictCachePath?: string;
		pendingPath?: string;
		loggingConfig?: LoggingConfig;
		verdictTtlMs?: number;
		uploadEnabled?: boolean;
		deferUnknownSkills?: boolean;
		agentRuntime?: string;
	} = {},
): Promise<boolean> {
	try {
		const skills = await computeSkillIdsForRoot(plugin.installPath, logger);
		if (skills.length === 0) return false;

		// Phase 1 — serve from the persistent verdict cache.
		const verdictCache = await loadSkillVerdictCache(
			paths.verdictCachePath,
			paths.verdictTtlMs,
			logger,
		);
		const uncached: Array<{ folder: string; skillId: string }> = [];
		for (const skill of skills) {
			const cached = getVerdict(verdictCache, skill.skillId, paths.verdictTtlMs);
			if (cached) {
				pushSkillFindingIfRisky(findings, plugin, skill.skillId, skill.folder, cached);
			} else {
				uncached.push(skill);
			}
		}
		if (uncached.length === 0) return false;

		// Phase 2 — look up unknown skills by hash.
		const client = new SkillCheckClient(undefined, logger);
		const verdicts = await client.checkSkills(uncached.map((s) => s.skillId));

		const marker = await loadPendingMarker(paths.pendingPath, logger);
		let cacheModified = false;
		let markerModified = false;
		let lookupFailed = false;
		let graceDeferred = false;
		const resolvedPendingSkillIds = new Set<string>();
		/**
		 * Audit entries held back until the cache save succeeds (see below), keyed
		 * by skill id: `uncached` is per folder, and a skill id is content-derived,
		 * so two folders holding the same skill collapse to one cache row and must
		 * likewise produce one audit entry.
		 */
		const recordedVerdicts = new Map<string, RecordedSkillVerdict>();

		for (const { folder, skillId } of uncached) {
			if (!verdicts.has(skillId)) {
				// Skill absent from map = lookup failed (outage / partial batch error).
				// Fail open on uploads: skip enqueueing so a transient outage doesn't
				// flood the analyzer — but remember the failure so the plugin is not
				// cached as clean below (the cheap hash lookup retries next session).
				lookupFailed = true;
				continue;
			}
			// A verdict OBJECT means the analyzer has already classified this skill.
			// A `null` value means the analyzer has never seen it
			// (per /batch/results: "not found → null") — that is the trigger to
			// upload it for analysis.
			const verdict = verdicts.get(skillId) ?? null;
			if (verdict) {
				// Known: cache it so later sessions skip the network entirely. Record
				// each skill id once — a second folder with the same content would mint
				// another entryId, overwrite the cache row with it, and still log the
				// first one as an orphan. The finding below stays per folder.
				if (!recordedVerdicts.has(skillId)) {
					recordedVerdicts.set(
						skillId,
						recordAnalyzedSkillVerdict(verdictCache, skillId, verdict, {
							skillName: basename(folder),
							agentRuntime: paths.agentRuntime,
							containerKey: plugin.key,
							loggingConfig: paths.loggingConfig,
						}),
					);
					cacheModified = true;
				}
				pushSkillFindingIfRisky(findings, plugin, skillId, folder, verdict);
				// Clear after the batch cache write succeeds; otherwise retain it for retry.
				if (isPending(marker, skillId)) {
					resolvedPendingSkillIds.add(skillId);
				}
			} else if (!isPending(marker, skillId)) {
				// Server returned null → never seen this skill.
				if (paths.uploadEnabled === false) {
					// Uploads are off this session.
					//  - Grace (one-time notice session): uploads turn ON next session,
					//    so defer this plugin's cache — otherwise it caches as clean now
					//    and the next session cache-hits it, never queueing the skill
					//    (activation silently slips by a full cache TTL). See trap 1.
					//  - Stable lookup-only mode (user set upload_enabled=false): no
					//    deferral — nothing will ever be queued, so cache as usual.
					if (paths.deferUnknownSkills) graceDeferred = true;
				} else {
					// Hand it to the upload worker (deduped via the pending marker).
					addPending(marker, skillId, folder, {
						agentRuntime: paths.agentRuntime,
						containerKey: plugin.key,
					});
					markerModified = true;
					if (paths.loggingConfig) {
						logSkillQueued(paths.loggingConfig, skillId, plugin.key, folder).catch(() => {});
					}
				}
			}
		}

		const cacheSaved = cacheModified
			? await saveSkillVerdictCache(verdictCache, paths.verdictCachePath, logger)
			: true;
		if (cacheSaved) {
			// Audit only now: a verdict whose cache row was not persisted is looked up
			// again next session and recorded under a fresh entryId, so logging before
			// the save would leave an orphaned "analyzed" row no cache entry joins to.
			// A failed audit write must not abort the pending-marker clear below.
			await Promise.all(
				[...recordedVerdicts.values()].map((entry) => entry.writeAuditEntry().catch(() => {})),
			);
			for (const skillId of resolvedPendingSkillIds) {
				removePending(marker, skillId);
				markerModified = true;
			}
		} else {
			lookupFailed = true;
		}
		if (markerModified) await savePendingMarker(marker, paths.pendingPath, logger);
		// Defer cache when any skill is still awaiting a verdict — either newly
		// queued this session OR already in the pending marker from a prior session
		// (e.g. the upload worker didn't run because the script was missing). Without
		// this, the second scan would see isPending=true, skip addPending, leave
		// markerModified=false, and incorrectly cache the plugin as clean.
		// Also defer on a failed lookup: otherwise a transient skill-check outage
		// would cache the plugin as clean for the full scan-cache TTL, suppressing
		// detection of its skills until the cache expires.
		const anyStillPending = uncached.some(({ skillId }) => isPending(marker, skillId));
		return markerModified || anyStillPending || lookupFailed || graceDeferred;
	} catch (e) {
		logger.debug("Skill check failed", { error: String(e) });
		return false;
	}
}
