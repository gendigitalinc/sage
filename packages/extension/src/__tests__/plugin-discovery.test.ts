import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nullLogger } from "@gendigital/sage-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverExtensionPlugins } from "../plugin-discovery.js";

describe("discoverExtensionPlugins", () => {
	let dir: string;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "sage-ext-discovery-"));
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it("discovers extensions from dirs with package.json", async () => {
		const extDir = join(dir, "publisher.my-extension-1.0.0");
		await mkdir(extDir, { recursive: true });
		await writeFile(
			join(extDir, "package.json"),
			JSON.stringify({ name: "my-extension", version: "1.0.0" }),
		);

		const plugins = await discoverExtensionPlugins(nullLogger, dir);
		expect(plugins).toHaveLength(1);
		expect(plugins[0]?.key).toBe("my-extension@1.0.0");
		expect(plugins[0]?.installPath).toBe(extDir);
		expect(plugins[0]?.version).toBe("1.0.0");
	});

	it("skips directories without package.json", async () => {
		const extDir = join(dir, "broken-ext");
		await mkdir(extDir, { recursive: true });
		await writeFile(join(extDir, "index.js"), "module.exports = {};");

		const plugins = await discoverExtensionPlugins(nullLogger, dir);
		expect(plugins).toHaveLength(0);
	});

	it("skips non-directory entries", async () => {
		await writeFile(join(dir, "extensions.json"), "[]");

		const extDir = join(dir, "real-ext");
		await mkdir(extDir, { recursive: true });
		await writeFile(
			join(extDir, "package.json"),
			JSON.stringify({ name: "real-ext", version: "2.0.0" }),
		);

		const plugins = await discoverExtensionPlugins(nullLogger, dir);
		expect(plugins).toHaveLength(1);
		expect(plugins[0]?.key).toBe("real-ext@2.0.0");
	});

	it("handles missing extensions directory", async () => {
		const plugins = await discoverExtensionPlugins(nullLogger, join(dir, "nonexistent"));
		expect(plugins).toHaveLength(0);
	});

	it("discovers multiple extensions", async () => {
		for (const name of ["alpha", "beta", "gamma"]) {
			const extDir = join(dir, name);
			await mkdir(extDir, { recursive: true });
			await writeFile(join(extDir, "package.json"), JSON.stringify({ name, version: "1.0.0" }));
		}

		const plugins = await discoverExtensionPlugins(nullLogger, dir);
		expect(plugins).toHaveLength(3);
	});

	it("falls back to directory name when package.json has no name", async () => {
		const extDir = join(dir, "unnamed-ext");
		await mkdir(extDir, { recursive: true });
		await writeFile(join(extDir, "package.json"), JSON.stringify({ version: "0.1.0" }));

		const plugins = await discoverExtensionPlugins(nullLogger, dir);
		expect(plugins).toHaveLength(1);
		expect(plugins[0]?.key).toBe("unnamed-ext@0.1.0");
	});

	it("uses 'unknown' version when package.json has no version", async () => {
		const extDir = join(dir, "no-version");
		await mkdir(extDir, { recursive: true });
		await writeFile(join(extDir, "package.json"), JSON.stringify({ name: "no-version" }));

		const plugins = await discoverExtensionPlugins(nullLogger, dir);
		expect(plugins).toHaveLength(1);
		expect(plugins[0]?.key).toBe("no-version@unknown");
	});
});
