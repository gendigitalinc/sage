import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	anyRequiredModelMissing,
	getDownloadStagingDir,
	getModelDir,
	getModelStorageRoot,
	isModelPresent,
	MODEL_SCHEMA_VERSION,
	missingRequiredModels,
	REQUIRED_MODELS_BY_SCHEMA,
	requiredModelFiles,
} from "../model-storage.js";

let sageDir: string;

beforeEach(() => {
	sageDir = mkdtempSync(join(tmpdir(), "sage-models-"));
});

afterEach(() => {
	rmSync(sageDir, { recursive: true, force: true });
});

describe("model-storage paths", () => {
	it("getModelStorageRoot returns <sageDir>/models", () => {
		expect(getModelStorageRoot(sageDir)).toBe(join(sageDir, "models"));
	});

	it("getModelDir uses the baked-in schema by default", () => {
		expect(getModelDir("pi-model", undefined, sageDir)).toBe(
			join(sageDir, "models", MODEL_SCHEMA_VERSION, "pi-model"),
		);
	});

	it("getModelDir honours an explicit schema override", () => {
		expect(getModelDir("future", "v9", sageDir)).toBe(join(sageDir, "models", "v9", "future"));
	});

	it("getDownloadStagingDir is a sibling of the schema dirs", () => {
		expect(getDownloadStagingDir(sageDir)).toBe(join(sageDir, "models", ".download"));
	});
});

describe("isModelPresent", () => {
	it("returns false when no files exist", () => {
		expect(isModelPresent("pi-model", undefined, sageDir)).toBe(false);
	});

	it("returns true once every required file is on disk", () => {
		const dir = getModelDir("pi-model", undefined, sageDir);
		mkdirSync(dir, { recursive: true });
		for (const f of requiredModelFiles("pi-model")) {
			writeFileSync(join(dir, f), "stub");
		}
		expect(isModelPresent("pi-model", undefined, sageDir)).toBe(true);
	});

	it("returns false when one required file is missing", () => {
		const dir = getModelDir("pi-model", undefined, sageDir);
		mkdirSync(dir, { recursive: true });
		const required = requiredModelFiles("pi-model");
		for (const f of required.slice(0, -1)) {
			writeFileSync(join(dir, f), "stub");
		}
		expect(isModelPresent("pi-model", undefined, sageDir)).toBe(false);
	});

	it("returns false for an unknown model name", () => {
		expect(isModelPresent("does-not-exist", undefined, sageDir)).toBe(false);
	});
});

describe("missingRequiredModels / anyRequiredModelMissing", () => {
	it("lists all schema-required models when nothing is installed", () => {
		const expected = REQUIRED_MODELS_BY_SCHEMA[MODEL_SCHEMA_VERSION] ?? [];
		expect(missingRequiredModels(undefined, sageDir)).toEqual([...expected]);
		expect(anyRequiredModelMissing(undefined, sageDir)).toBe(true);
	});

	it("returns empty when every required model has been installed", () => {
		for (const name of REQUIRED_MODELS_BY_SCHEMA[MODEL_SCHEMA_VERSION] ?? []) {
			const dir = getModelDir(name, undefined, sageDir);
			mkdirSync(dir, { recursive: true });
			for (const f of requiredModelFiles(name)) {
				writeFileSync(join(dir, f), "stub");
			}
		}
		expect(missingRequiredModels(undefined, sageDir)).toEqual([]);
		expect(anyRequiredModelMissing(undefined, sageDir)).toBe(false);
	});

	it("returns empty for a schema with no required models", () => {
		expect(missingRequiredModels("never-shipped", sageDir)).toEqual([]);
		expect(anyRequiredModelMissing("never-shipped", sageDir)).toBe(false);
	});
});
