/**
 * High-level session start orchestrator.
 * Combines plugin scanning, version check, temp cleanup, and (optionally)
 * a detached background PI model download into a single call.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { loadConfig, resolvePath } from "./config.js";
import { pruneOrphanedTmpFiles } from "./file-utils.js";
import { getInstallationId } from "./installation-id.js";
import { MODEL_SCHEMA_VERSION, missingRequiredModels } from "./model-storage.js";
import { runSessionStartScan } from "./session-start-scan.js";
import type { AgentRuntime, Logger, PluginInfo, PluginScanResult } from "./types.js";
import { nullLogger } from "./types.js";
import { checkForUpdate, type VersionCheckResult } from "./version-check.js";

export interface SessionStartContext {
	plugins: PluginInfo[];
	threatsDir: string;
	allowlistsDir: string;
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
}

export interface SessionStartResult {
	scanResults: PluginScanResult[];
	versionCheck: VersionCheckResult | null;
}

export async function runSessionStart(ctx: SessionStartContext): Promise<SessionStartResult> {
	const logger = ctx.logger ?? nullLogger;
	const sageDirPath = resolvePath(ctx.sageDirPath ?? "~/.sage");

	// Fire-and-forget temp cleanup
	pruneOrphanedTmpFiles(sageDirPath).catch(() => {});

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

	// Start installation ID read early so it runs concurrently with the scan
	const iidPromise = getInstallationId(sageDirPath).catch(() => undefined);

	// Parallel: scan + (iid read → version check)
	const [scanResults, versionCheck] = await Promise.all([
		runSessionStartScan({
			plugins: ctx.plugins,
			threatsDir: ctx.threatsDir,
			allowlistsDir: ctx.allowlistsDir,
			sageVersion: ctx.version,
			logger,
			configPath: ctx.configPath,
			scanCachePath: ctx.scanCachePath,
			checkUrls: ctx.checkUrls,
			checkFileHashes: ctx.checkFileHashes,
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
				});
			})
			.catch(() => null),
	]);

	return { scanResults, versionCheck };
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
	agentRuntime?: AgentRuntime | string;
	agentRuntimeVersion?: string;
	versionApp?: string;
	logger?: Logger;
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
				SAGE_DIR: args.sageDirPath,
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
