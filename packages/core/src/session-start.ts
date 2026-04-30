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
import { anyRequiredModelMissing, MODEL_SCHEMA_VERSION } from "./model-storage.js";
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
	if (!args.workerPath) return;
	if (!existsSync(args.workerPath)) {
		args.logger.debug(`model download worker script not found at ${args.workerPath}`);
		return;
	}
	if (!anyRequiredModelMissing(MODEL_SCHEMA_VERSION, args.sageDirPath)) return;

	let piEnabled = false;
	try {
		const config = await loadConfig(args.configPath, args.logger);
		piEnabled = config.pi_check.enabled && !config.pi_check.model_path;
	} catch {
		piEnabled = false;
	}
	if (!piEnabled) return;

	spawnModelDownloadWorker({
		sageDirPath: args.sageDirPath,
		workerPath: args.workerPath,
		agentRuntime: args.agentRuntime,
		agentRuntimeVersion: args.agentRuntimeVersion,
		versionApp: args.versionApp,
		logger: args.logger,
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
export function spawnModelDownloadWorker(args: SpawnModelDownloadWorkerArgs): void {
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
	} catch (err) {
		logger.debug(`failed to spawn model download worker: ${err}`);
	}
}
