/**
 * On-disk layout for ML models downloaded at runtime.
 *
 * Models live under `~/.sage/models/<schema>/<modelName>/`. The schema tag
 * is a small monotonic string baked into source — bumped only when a Sage
 * release ships a model change that breaks back-compat with previously
 * downloaded files. Sage upgrades that don't change the model layout reuse
 * already-installed files; only a deliberate schema bump forces a
 * re-download.
 *
 * Old schema-version trees are deliberately left in place: a user may run
 * multiple Sage versions across environments sharing the same `~/.sage`,
 * and pruning would force the older client to re-download.
 *
 * Schema version is bumped only when the model format changes incompatibly.
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolvePath } from "./config.js";

/**
 * Bumped only when a Sage release ships a model change that breaks
 * back-compat with previously-downloaded files (different ONNX op set,
 * new tokenizer vocab, replacement model entirely, additional model
 * added that must be present together, etc.). Most patch and minor
 * releases will not touch this constant.
 */
export const MODEL_SCHEMA_VERSION = "v1";

/**
 * Per-schema list of models that must be on disk for `pi_check.enabled`
 * to do anything useful. The download worker only pulls models on this
 * list; manifest entries for other names are ignored, so a misbehaving
 * server can't push extra payloads onto users.
 */
export const REQUIRED_MODELS_BY_SCHEMA: Record<string, readonly string[]> = {
	v1: ["pi-model"],
};

/**
 * Files we ourselves ship in each model archive. Used to detect a
 * complete install. We deliberately do not list `package.json` or
 * `node_modules/` because those appear later (see `pi-deps-installer`)
 * after first inference, and including them here would cause
 * `isModelPresent` to return `false` until the user has actually run
 * the model once.
 */
const REQUIRED_MODEL_FILES: Record<string, readonly string[]> = {
	"pi-model": [
		"model_int8.onnx",
		"tokenizer.json",
		"tokenizer_config.json",
		"special_tokens_map.json",
		"vocab.txt",
		"config.json",
	],
};

/** `~/.sage/models/`. */
export function getModelStorageRoot(sageDir: string = resolvePath("~/.sage")): string {
	return join(resolvePath(sageDir), "models");
}

/** `~/.sage/models/<schema>/<modelName>/`. */
export function getModelDir(
	modelName: string,
	schema: string = MODEL_SCHEMA_VERSION,
	sageDir?: string,
): string {
	return join(getModelStorageRoot(sageDir), schema, modelName);
}

/** `~/.sage/models/.download/`. */
export function getDownloadStagingDir(sageDir?: string): string {
	return join(getModelStorageRoot(sageDir), ".download");
}

/**
 * True iff every file we shipped in the archive exists in the resolved
 * model directory. Files added later by `pi-deps-installer` (package.json,
 * node_modules/) are intentionally not checked.
 */
export function isModelPresent(
	modelName: string,
	schema: string = MODEL_SCHEMA_VERSION,
	sageDir?: string,
): boolean {
	const dir = getModelDir(modelName, schema, sageDir);
	const files = REQUIRED_MODEL_FILES[modelName];
	if (!files || files.length === 0) return false;
	return files.every((f) => existsSync(resolve(dir, f)));
}

/** Files we expect inside a freshly-extracted archive. */
export function requiredModelFiles(modelName: string): readonly string[] {
	return REQUIRED_MODEL_FILES[modelName] ?? [];
}

/**
 * Returns the names of required models for the current schema that are
 * not fully on disk. Used by session-start to decide whether to spawn
 * the download worker.
 */
export function missingRequiredModels(
	schema: string = MODEL_SCHEMA_VERSION,
	sageDir?: string,
): string[] {
	const required = REQUIRED_MODELS_BY_SCHEMA[schema] ?? [];
	return required.filter((name) => !isModelPresent(name, schema, sageDir));
}

/** True iff at least one required model is missing for the current schema. */
export function anyRequiredModelMissing(
	schema: string = MODEL_SCHEMA_VERSION,
	sageDir?: string,
): boolean {
	return missingRequiredModels(schema, sageDir).length > 0;
}
