/**
 * Detached CLI worker process that downloads any missing ML models for the
 * current schema version.
 *
 * Reusable orchestration lives in `model-download.ts`; this file only handles
 * worker-specific env parsing and auto-run when invoked as a standalone
 * script. The worker is always fail-open: ML detection just stays off for
 * the session and the next session retries the whole flow.
 */

import { mkdir } from "node:fs/promises";
import { loadConfig, resolvePath } from "./config.js";
import { getInstallationId } from "./installation-id.js";
import { ensureModelsAvailable } from "./model-download.js";
import { getModelStorageRoot, MODEL_SCHEMA_VERSION } from "./model-storage.js";
import { createOperationalLogger } from "./operational-log.js";
import { type AgentRuntime, type Logger, nullLogger } from "./types.js";

async function readWorkerArgs(): Promise<{
	sageDir: string;
	agentRuntime: string;
	agentRuntimeVersion?: string;
	versionApp?: string;
	schema: string;
} | null> {
	const env = process.env;
	const sageDir = env.SAGE_DIR ? resolvePath(env.SAGE_DIR) : resolvePath("~/.sage");
	const agentRuntime = env.SAGE_AGENT_RUNTIME ?? "unknown";
	const agentRuntimeVersion = env.SAGE_AGENT_RUNTIME_VERSION || undefined;
	const versionApp = env.SAGE_VERSION_APP || undefined;
	const schema = env.SAGE_MODEL_SCHEMA || MODEL_SCHEMA_VERSION;
	return { sageDir, agentRuntime, agentRuntimeVersion, versionApp, schema };
}

async function createWorkerLogger(agentRuntime: string): Promise<Logger> {
	try {
		const config = await loadConfig();
		return createOperationalLogger(
			config.operational_logging,
			agentRuntime as AgentRuntime,
		).forComponent("model-download-worker");
	} catch {
		return nullLogger;
	}
}

async function workerMain(): Promise<void> {
	const args = await readWorkerArgs();
	if (!args) return;
	const logger = await createWorkerLogger(args.agentRuntime);
	try {
		logger.debug("Model download worker started", {
			schema: args.schema,
			agentRuntime: args.agentRuntime,
			agentRuntimeVersion: args.agentRuntimeVersion,
			versionApp: args.versionApp,
		});

		// Make sure the storage root exists so the downloader doesn't have to
		// create it later.
		await mkdir(getModelStorageRoot(args.sageDir), { recursive: true }).catch(() => {});

		const iid = await getInstallationId(args.sageDir).catch(() => undefined);
		if (!iid) {
			logger.debug("Model download worker completed", {
				result: "skipped",
				skippedReason: "missing_installation_id",
			});
			await logger.flush?.();
			return;
		}

		const installedModels = await ensureModelsAvailable({
			sageDir: args.sageDir,
			iid,
			agentRuntime: args.agentRuntime,
			agentRuntimeVersion: args.agentRuntimeVersion,
			versionApp: args.versionApp,
			schema: args.schema,
			logger,
		});
		logger.debug("Model download worker completed", {
			result: "completed",
			installedModels,
		});
		await logger.flush?.();
	} catch (error) {
		logger.error("Model download worker failed open", {
			error: String(error),
			schema: args.schema,
			agentRuntime: args.agentRuntime,
			agentRuntimeVersion: args.agentRuntimeVersion,
			versionApp: args.versionApp,
		});
		await logger.flush?.();
	}
}

// Auto-run when invoked as a standalone script. The detection is strict:
// the file must be the process entry point (basename match on argv[1]) AND
// the SAGE_DIR env var must be set (always set by spawnModelDownloadWorker).
// This keeps the auto-run from firing when this module is merely imported by
// other code paths rather than executed as the detached worker entrypoint.
const isWorkerEntry = (() => {
	try {
		const argv1 = process.argv[1] ?? "";
		const looksLikeWorker =
			argv1.endsWith("model-download-worker.cjs") || argv1.endsWith("model-download-worker.js");
		return looksLikeWorker && typeof process.env.SAGE_DIR === "string";
	} catch {
		return false;
	}
})();

if (isWorkerEntry) {
	workerMain().catch(() => {
		// Always fail-open.
		process.exit(0);
	});
}
