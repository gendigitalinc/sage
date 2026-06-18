import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	cacheKey,
	computeConfigHash,
	getCached,
	isCached,
	loadScanCache,
	saveScanCache,
	storeResult,
} from "../plugin-scan-cache.js";
import type { PluginScanCache } from "../types.js";
import { makeTmpDir } from "./test-utils.js";

describe("cacheKey", () => {
	it("combines plugin key, version, and last updated", () => {
		expect(cacheKey("my-plugin", "1.0.0", "2024-01-01")).toBe("my-plugin:1.0.0:2024-01-01");
	});
});

describe("computeConfigHash", () => {
	it("hashes YAML files in directory", async () => {
		const dir = await makeTmpDir();
		await writeFile(join(dir, "threats.yaml"), "- id: test\n");
		const hash = await computeConfigHash("", dir);
		expect(hash).toMatch(/^[0-9a-f]{16}$/);
	});

	it("changes when file content changes", async () => {
		const dir = await makeTmpDir();
		await writeFile(join(dir, "threats.yaml"), "- id: test1\n");
		const hash1 = await computeConfigHash("", dir);
		await writeFile(join(dir, "threats.yaml"), "- id: test2\n");
		const hash2 = await computeConfigHash("", dir);
		expect(hash1).not.toBe(hash2);
	});

	it("returns consistent hash for same content", async () => {
		const dir = await makeTmpDir();
		await writeFile(join(dir, "threats.yaml"), "- id: stable\n");
		const h1 = await computeConfigHash("", dir);
		const h2 = await computeConfigHash("", dir);
		expect(h1).toBe(h2);
	});

	it("changes when sageVersion changes", async () => {
		const dir = await makeTmpDir();
		await writeFile(join(dir, "threats.yaml"), "- id: test\n");
		const hash1 = await computeConfigHash("0.4.0", dir);
		const hash2 = await computeConfigHash("0.5.0", dir);
		expect(hash1).not.toBe(hash2);
	});
});

describe("loadScanCache / saveScanCache", () => {
	it("returns empty cache for missing file", async () => {
		const cache = await loadScanCache("hash1", "/nonexistent/cache.json");
		expect(cache.configHash).toBe("hash1");
		expect(Object.keys(cache.entries)).toHaveLength(0);
	});

	it("invalidates cache on config hash mismatch", async () => {
		const dir = await makeTmpDir();
		const cachePath = join(dir, "cache.json");
		await writeFile(
			cachePath,
			JSON.stringify({
				config_hash: "old_hash",
				entries: {
					"plugin:1.0:2024": {
						plugin_key: "plugin",
						version: "1.0",
						scanned_at: new Date().toISOString(),
						findings: [],
					},
				},
			}),
		);

		const cache = await loadScanCache("new_hash", cachePath);
		expect(Object.keys(cache.entries)).toHaveLength(0);
	});

	it("round-trips save/load", async () => {
		const dir = await makeTmpDir();
		const cachePath = join(dir, "cache.json");
		const cache: PluginScanCache = { configHash: "test_hash", entries: {} };
		storeResult(cache, "my-plugin", "1.0", "2024-01-01", []);
		await saveScanCache(cache, cachePath);

		const loaded = await loadScanCache("test_hash", cachePath);
		expect(Object.keys(loaded.entries)).toHaveLength(1);
	});
});

describe("isCached / getCached / storeResult", () => {
	it("returns false for uncached plugin", () => {
		const cache: PluginScanCache = { configHash: "", entries: {} };
		expect(isCached(cache, "plugin", "1.0", "2024")).toBe(false);
	});

	it("returns true for freshly cached plugin", () => {
		const cache: PluginScanCache = { configHash: "", entries: {} };
		storeResult(cache, "plugin", "1.0", "2024", []);
		expect(isCached(cache, "plugin", "1.0", "2024")).toBe(true);
	});

	it("returns false for expired cache entry", () => {
		const cache: PluginScanCache = {
			configHash: "",
			entries: {
				"plugin:1.0:2024": {
					pluginKey: "plugin",
					version: "1.0",
					scannedAt: "2020-01-01T00:00:00Z", // Long ago
					findings: [],
				},
			},
		};
		expect(isCached(cache, "plugin", "1.0", "2024")).toBe(false);
	});

	it("getCached returns result for valid entry", () => {
		const cache: PluginScanCache = { configHash: "", entries: {} };
		storeResult(cache, "plugin", "1.0", "2024", [
			{
				threat_id: "T1",
				title: "Bad",
				severity: "warning",
				artifact: "x",
				source_file: "y",
			},
		]);
		const result = getCached(cache, "plugin", "1.0", "2024");
		expect(result).not.toBeNull();
		expect(result?.findings).toHaveLength(1);
	});
});
