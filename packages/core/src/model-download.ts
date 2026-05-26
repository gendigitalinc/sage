/**
 * Reusable background model download orchestration.
 *
 * This is the non-CLI part of the model-download flow: the detached worker
 * entrypoint lives in `model-download-worker.ts`, while long-lived hosts and
 * tests can call `ensureModelsAvailable()` directly without importing the
 * worker's auto-run logic.
 */

import { downloadModel } from "./clients/model-downloader.js";
import { fetchModelManifest, type ModelManifestEntry } from "./clients/model-manifest.js";
import {
	MODEL_SCHEMA_VERSION,
	missingRequiredModels,
	REQUIRED_MODELS_BY_SCHEMA,
} from "./model-storage.js";
import type { AgentRuntime, Logger } from "./types.js";
import { nullLogger } from "./types.js";

export interface EnsureModelsAvailableArgs {
	sageDir: string;
	iid: string;
	agentRuntime?: AgentRuntime | string;
	agentRuntimeVersion?: string;
	versionApp?: string;
	schema?: string;
	logger?: Logger;
}

/**
 * Reads the manifest, then downloads only the locally-required models that
 * are still missing on disk. Manifest entries for unknown model names are
 * intentionally ignored.
 *
 * Returns the list of model names that ended up installed (or were already
 * present) when the call returned.
 */
export async function ensureModelsAvailable(args: EnsureModelsAvailableArgs): Promise<string[]> {
	const logger = args.logger ?? nullLogger;
	const schema = args.schema ?? MODEL_SCHEMA_VERSION;
	const sageDir = args.sageDir;
	const required = REQUIRED_MODELS_BY_SCHEMA[schema] ?? [];
	if (required.length === 0) return [];

	const missing = missingRequiredModels(schema, sageDir);
	logger.debug("Model availability check started", {
		schema,
		requiredModels: required,
		missingModels: missing,
	});
	if (missing.length === 0) {
		logger.debug("Model availability check completed", {
			schema,
			result: "already_available",
			installedModels: required,
		});
		return [...required];
	}

	const manifest = await fetchModelManifest({
		iid: args.iid,
		schema,
		agentRuntime: args.agentRuntime ?? "unknown",
		agentRuntimeVersion: args.agentRuntimeVersion,
		versionApp: args.versionApp,
		logger,
	});
	if (!manifest) {
		const installed = required.filter((name) => !missing.includes(name));
		logger.debug("Model availability check completed", {
			schema,
			result: "skipped",
			skippedReason: "manifest_unavailable",
			installedModels: installed,
			missingModels: missing,
		});
		return installed;
	}

	const installed = new Set<string>(required.filter((name) => !missing.includes(name)));
	for (const name of missing) {
		const entry: ModelManifestEntry | undefined = manifest.models[name];
		if (!entry) {
			logger.warn(`required model '${name}' missing from manifest; skipping`);
			continue;
		}
		try {
			const ok = await downloadModel({
				modelName: name,
				entry,
				schema,
				sageDir,
				logger,
			});
			if (ok) installed.add(name);
		} catch (err) {
			logger.warn(`download of model '${name}' threw: ${err}`);
		}
	}
	const installedModels = [...installed];
	logger.debug("Model availability check completed", {
		schema,
		result: "checked",
		installedModels,
		missingModels: required.filter((name) => !installed.has(name)),
	});
	return installedModels;
}
