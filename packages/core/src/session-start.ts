/**
 * High-level session start orchestrator.
 * Combines plugin scanning, version check, temp cleanup, and (optionally)
 * a detached background PI model download into a single call.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, resolvePath } from "./config.js";
import { deployConfigDefaults } from "./config-defaults.js";
import { pruneOrphanedTmpFiles } from "./file-utils.js";
import { resolveSkillUploadRollout } from "./install-state.js";
import { getInstallationId } from "./installation-id.js";
import { MODEL_SCHEMA_VERSION, missingRequiredModels } from "./model-storage.js";
import { SKILL_UPLOAD_NOTICE } from "./notices.js";
import { runSessionStartScan } from "./session-start-scan.js";
import { listPending, loadPendingMarker } from "./skill-pending.js";
import { getUserThreatsDir, loadThreats } from "./threat-loader.js";
import type { AgentRuntime, Logger, PluginInfo, PluginScanResult } from "./types.js";
import { nullLogger } from "./types.js";
import { checkForUpdate, type VersionCheckResult } from "./version-check.js";

export interface SessionStartContext {
	plugins: PluginInfo[];
	threatsDir: string;
	trustedDomainsDir: string;
	version: string;
	agentRuntime: AgentRuntime;
	logger?: Logger;
	configPath?: string;
	scanCachePath?: string;
	checkUrls?: boolean;
	checkFileHashes?: boolean;
	sageDirPath?: string;
	agentRuntimeVersion?: string;
	/**
	 * Absolute path to the model-download worker script (per-connector
	 * esbuild artefact, e.g. `dist/model-download-worker.cjs`). When
	 * provided and `pi_check.enabled` is true and any required model is
	 * missing on disk, the worker is spawned detached at session start.
	 */
	modelDownloadWorkerPath?: string;
	/**
	 * Absolute path to the skill-upload worker script (per-connector esbuild
	 * artefact, e.g. `dist/skill-upload-worker.cjs`). When provided and the scan
	 * queued unknown skills in the pending marker, the worker is spawned detached
	 * after the scan completes.
	 */
	skillUploadWorkerPath?: string;
	/**
	 * Whether this scan may commit the one-time notice flag and surface the notice
	 * itself. Defaults true. Pass false for connectors that deliver the notice in a
	 * separate process/turn (OpenClaw), which commit at delivery via
	 * `takePendingNotices`. See `resolveSkillUploadRollout`.
	 */
	commitUploadNotice?: boolean;
}

export interface SessionStartResult {
	scanResults: PluginScanResult[];
	versionCheck: VersionCheckResult | null;
	/**
	 * Ids of one-time notices this session should show (see notices.ts). Each
	 * connector renders them via `formatNoticeById` at its own surface (Claude
	 * Code `systemMessage`, OpenCode toast, extension info message). Empty/absent
	 * when there's nothing to show, and always empty on the deferred-delivery path
	 * (OpenClaw), which resolves notices from disk via `takePendingNotices`.
	 */
	notices?: string[];
}

export async function runSessionStart(ctx: SessionStartContext): Promise<SessionStartResult> {
	const logger = ctx.logger ?? nullLogger;
	const sageDirPath = resolvePath(ctx.sageDirPath ?? "~/.sage");

	// Load once at session start so each active custom rule is visible in the
	// operational log. Runtime evaluations load the same files when matching.
	try {
		await loadThreats(ctx.threatsDir, logger, {
			customThreatsDir: getUserThreatsDir(sageDirPath),
			logCustomRuleIds: true,
		});
	} catch (error) {
		logger.warn("Threat rules failed to load at session start (fail-open)", {
			error: String(error),
		});
	}

	// Fire-and-forget temp cleanup
	pruneOrphanedTmpFiles(sageDirPath).catch(() => {});
	deployConfigDefaults(sageDirPath, logger).catch(() => {});

	// Kick off the background model download worker if needed. Decision is
	// fully synchronous (file-system check + config load) and the spawn
	// itself returns immediately — no awaiting.
	maybeSpawnModelDownloadWorker({
		sageDirPath,
		workerPath: ctx.modelDownloadWorkerPath,
		configPath: ctx.configPath,
		agentRuntime: ctx.agentRuntime,
		agentRuntimeVersion: ctx.agentRuntimeVersion,
		versionApp: ctx.version,
		logger,
	}).catch(() => {});

	// Resolve the skill-upload consent rollout once, before the scan, and thread
	// the single decision through BOTH gates (scan-time queueing and worker
	// spawn) so they can't disagree. During the one-time notice session
	// `uploadActive` is false — nothing is queued and the worker is never
	// spawned; activation is deferred to the next session.
	const rollout = await resolveSkillUploadRollout({
		sageDirPath,
		configPath: ctx.configPath,
		version: ctx.version,
		logger,
		commitNotice: ctx.commitUploadNotice ?? true,
	});

	// Start installation ID read early so it runs concurrently with the scan
	const iidPromise = getInstallationId(sageDirPath).catch(() => undefined);

	// Parallel: scan + (iid read → version check)
	const [scanResults, versionCheck] = await Promise.all([
		runSessionStartScan({
			plugins: ctx.plugins,
			threatsDir: ctx.threatsDir,
			trustedDomainsDir: ctx.trustedDomainsDir,
			sageVersion: ctx.version,
			logger,
			configPath: ctx.configPath,
			scanCachePath: ctx.scanCachePath,
			checkUrls: ctx.checkUrls,
			checkFileHashes: ctx.checkFileHashes,
			sageDirPath,
			agentRuntime: ctx.agentRuntime,
			uploadUnknownSkills: rollout.uploadActive,
			deferUnknownSkills: rollout.deferUnknownSkills,
		}),
		iidPromise
			.then((iid) => {
				if (!iid) {
					return null;
				}

				return checkForUpdate(ctx.version, logger, undefined, {
					agentRuntime: ctx.agentRuntime,
					agentRuntimeVersion: ctx.agentRuntimeVersion,
					iid,
					configPath: ctx.configPath,
				});
			})
			.catch(() => null),
	]);

	// After the scan: if it queued any unknown skills, kick off the detached
	// upload worker. Done post-scan (not in parallel) because the scan is what
	// populates the pending marker the worker consumes.
	maybeSpawnSkillUploadWorker({
		sageDirPath,
		workerPath: ctx.skillUploadWorkerPath,
		configPath: ctx.configPath,
		agentRuntime: ctx.agentRuntime,
		uploadActive: rollout.uploadActive,
		logger,
	}).catch(() => {});

	return {
		scanResults,
		versionCheck,
		notices: rollout.showNotice ? [SKILL_UPLOAD_NOTICE.id] : [],
	};
}

interface MaybeSpawnArgs {
	sageDirPath: string;
	workerPath: string | undefined;
	configPath: string | undefined;
	agentRuntime: AgentRuntime;
	agentRuntimeVersion: string | undefined;
	versionApp: string;
	logger: Logger;
}

async function maybeSpawnModelDownloadWorker(args: MaybeSpawnArgs): Promise<void> {
	if (!args.workerPath) {
		args.logger.debug("Model download worker skipped", {
			result: "skipped",
			skippedReason: "missing_worker_path",
		});
		return;
	}
	if (!existsSync(args.workerPath)) {
		args.logger.debug("Model download worker skipped", {
			result: "skipped",
			skippedReason: "worker_script_not_found",
			workerPath: args.workerPath,
		});
		return;
	}
	const missingModels = missingRequiredModels(MODEL_SCHEMA_VERSION, args.sageDirPath);
	if (missingModels.length === 0) {
		args.logger.debug("Model download worker skipped", {
			result: "skipped",
			skippedReason: "no_missing_models",
			schema: MODEL_SCHEMA_VERSION,
		});
		return;
	}

	let piEnabled = false;
	try {
		const config = await loadConfig(args.configPath, args.logger);
		piEnabled = config.pi_check.enabled && !config.pi_check.model_path;
	} catch {
		piEnabled = false;
	}
	if (!piEnabled) {
		args.logger.debug("Model download worker skipped", {
			result: "skipped",
			skippedReason: "pi_check_disabled",
			schema: MODEL_SCHEMA_VERSION,
			missingModels,
		});
		return;
	}

	const spawned = spawnModelDownloadWorker({
		sageDirPath: args.sageDirPath,
		workerPath: args.workerPath,
		configPath: args.configPath,
		agentRuntime: args.agentRuntime,
		agentRuntimeVersion: args.agentRuntimeVersion,
		versionApp: args.versionApp,
		logger: args.logger,
	});
	args.logger.debug("Model download worker spawn completed", {
		result: spawned ? "spawned" : "failed",
		schema: MODEL_SCHEMA_VERSION,
		missingModels,
	});
}

export interface SpawnModelDownloadWorkerArgs {
	sageDirPath: string;
	workerPath: string;
	configPath?: string;
	agentRuntime?: AgentRuntime | string;
	agentRuntimeVersion?: string;
	versionApp?: string;
	logger?: Logger;
}

/**
 * Extra env needed to run a detached worker under Bun-based hosts (OpenCode).
 * There, `process.execPath` is the compiled `opencode` single-file executable,
 * which relaunches the app unless `BUN_BE_BUN=1` tells it to behave as the bare
 * `bun` JS runtime and execute the given script. Node ignores the variable, so
 * we gate on `process.versions.bun` and add nothing on Node-based connectors.
 */
function bunRuntimeEnv(): Record<string, string> {
	return process.versions.bun ? { BUN_BE_BUN: "1" } : {};
}

/**
 * Spawn the per-connector model download worker as a detached child.
 * `detached: true` + `stdio: "ignore"` + `unref()` is the standard Node
 * pattern for letting the parent exit while the child keeps running —
 * required because connector hooks (CC, Cursor, VS Code) are short-lived
 * subprocesses that would otherwise kill an in-process download.
 */
export function spawnModelDownloadWorker(args: SpawnModelDownloadWorkerArgs): boolean {
	const logger = args.logger ?? nullLogger;
	try {
		const child = spawn(process.execPath, [args.workerPath], {
			detached: true,
			stdio: "ignore",
			env: {
				...process.env,
				...bunRuntimeEnv(),
				SAGE_DIR: args.sageDirPath,
				SAGE_CONFIG_PATH: args.configPath ?? "",
				SAGE_AGENT_RUNTIME: String(args.agentRuntime ?? "unknown"),
				SAGE_AGENT_RUNTIME_VERSION: args.agentRuntimeVersion ?? "",
				SAGE_VERSION_APP: args.versionApp ?? "",
				SAGE_MODEL_SCHEMA: MODEL_SCHEMA_VERSION,
			},
		});
		child.unref();
		return true;
	} catch (err) {
		logger.warn("Failed to spawn model download worker", { error: String(err) });
		return false;
	}
}

interface MaybeSpawnSkillArgs {
	sageDirPath: string;
	workerPath: string | undefined;
	configPath?: string;
	agentRuntime: AgentRuntime;
	uploadActive: boolean;
	logger: Logger;
}

/**
 * Spawn the skill-upload worker, but only when the just-completed scan actually
 * queued unknown skills (the pending marker is non-empty). Reads the marker from
 * `sageDirPath` — the same path `runSkillCheck` writes to.
 */
async function maybeSpawnSkillUploadWorker(args: MaybeSpawnSkillArgs): Promise<void> {
	// Gate on the resolved rollout decision, NOT a fresh config read. This is the
	// spawn-side half of the single upload gate — suppressing only the scan-side
	// queueing would still let a stale pending entry be uploaded here (trap 2).
	if (!args.uploadActive) {
		args.logger.debug("Skill upload worker skipped", {
			result: "skipped",
			skippedReason: "upload_inactive",
		});
		return;
	}
	try {
		const config = await loadConfig(args.configPath, args.logger);
		if (!config.skill_check.enabled) {
			args.logger.debug("Skill upload worker skipped", {
				result: "skipped",
				skippedReason: "skill_check_disabled",
			});
			return;
		}
	} catch {
		// Fail open — proceed if config is unreadable.
	}

	if (!args.workerPath) {
		args.logger.debug("Skill upload worker skipped", {
			result: "skipped",
			skippedReason: "missing_worker_path",
		});
		return;
	}
	if (!existsSync(args.workerPath)) {
		args.logger.debug("Skill upload worker skipped", {
			result: "skipped",
			skippedReason: "worker_script_not_found",
			workerPath: args.workerPath,
		});
		return;
	}

	const marker = await loadPendingMarker(join(args.sageDirPath, "skill_pending.json"), args.logger);
	const pendingCount = listPending(marker).length;
	if (pendingCount === 0) {
		args.logger.debug("Skill upload worker skipped", {
			result: "skipped",
			skippedReason: "no_pending_skills",
		});
		return;
	}

	const spawned = spawnSkillUploadWorker({
		sageDirPath: args.sageDirPath,
		workerPath: args.workerPath,
		agentRuntime: args.agentRuntime,
		logger: args.logger,
	});
	args.logger.debug("Skill upload worker spawn completed", {
		result: spawned ? "spawned" : "failed",
		pendingCount,
	});
}

export interface SpawnSkillUploadWorkerArgs {
	sageDirPath: string;
	workerPath: string;
	agentRuntime?: AgentRuntime | string;
	logger?: Logger;
}

/**
 * Spawn the per-connector skill-upload worker as a detached child. Same
 * `detached` + `stdio: "ignore"` + `unref()` pattern as the model download
 * worker (see above) — the connector hook process is short-lived and would
 * otherwise kill an in-process upload.
 */
export function spawnSkillUploadWorker(args: SpawnSkillUploadWorkerArgs): boolean {
	const logger = args.logger ?? nullLogger;
	try {
		const child = spawn(process.execPath, [args.workerPath], {
			detached: true,
			stdio: "ignore",
			env: {
				...process.env,
				...bunRuntimeEnv(),
				SAGE_DIR: args.sageDirPath,
				SAGE_AGENT_RUNTIME: String(args.agentRuntime ?? "unknown"),
			},
		});
		child.unref();
		return true;
	} catch (err) {
		logger.warn("Failed to spawn skill upload worker", { error: String(err) });
		return false;
	}
}
