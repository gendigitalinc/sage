import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nullLogger } from "@gendigital/sage-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverOpenClawPlugins } from "../plugin-discovery.js";

describe("discoverOpenClawPlugins", () => {
	let dir: string;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "sage-discovery-test-"));
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it("discovers plugins from directory with package.json", async () => {
		const pluginDir = join(dir, "my-plugin");
		await mkdir(pluginDir, { recursive: true });
		await writeFile(
			join(pluginDir, "package.json"),
			JSON.stringify({ name: "my-plugin", version: "1.0.0" }),
		);

		const plugins = await discoverOpenClawPlugins(nullLogger, dir);
		expect(plugins).toHaveLength(1);
		expect(plugins[0]?.key).toBe("my-plugin@1.0.0");
		expect(plugins[0]?.installPath).toBe(pluginDir);
		expect(plugins[0]?.version).toBe("1.0.0");
	});

	it("skips directories without package.json", async () => {
		const pluginDir = join(dir, "no-pkg");
		await mkdir(pluginDir, { recursive: true });
		await writeFile(join(pluginDir, "index.js"), "module.exports = {};");

		const plugins = await discoverOpenClawPlugins(nullLogger, dir);
		expect(plugins).toHaveLength(0);
	});

	it("handles missing extensions directory", async () => {
		const plugins = await discoverOpenClawPlugins(nullLogger, join(dir, "nonexistent"));
		expect(plugins).toHaveLength(0);
	});

	it("discovers multiple plugins", async () => {
		for (const name of ["alpha", "beta"]) {
			const pluginDir = join(dir, name);
			await mkdir(pluginDir, { recursive: true });
			await writeFile(join(pluginDir, "package.json"), JSON.stringify({ name, version: "2.0.0" }));
		}

		const plugins = await discoverOpenClawPlugins(nullLogger, dir);
		expect(plugins).toHaveLength(2);
	});

	it("uses directory name when package.json has no name", async () => {
		const pluginDir = join(dir, "fallback-name");
		await mkdir(pluginDir, { recursive: true });
		await writeFile(join(pluginDir, "package.json"), JSON.stringify({ version: "0.1.0" }));

		const plugins = await discoverOpenClawPlugins(nullLogger, dir);
		expect(plugins).toHaveLength(1);
		expect(plugins[0]?.key).toBe("fallback-name@0.1.0");
	});

	it("skips entries that are files, not directories", async () => {
		await writeFile(join(dir, "not-a-dir.txt"), "hello");

		const pluginDir = join(dir, "real-plugin");
		await mkdir(pluginDir, { recursive: true });
		await writeFile(
			join(pluginDir, "package.json"),
			JSON.stringify({ name: "real-plugin", version: "1.0.0" }),
		);

		const plugins = await discoverOpenClawPlugins(nullLogger, dir);
		expect(plugins).toHaveLength(1);
	});
});
