/**
 * Integration tests for sage-statusline cleanup behavior.
 *
 * Spawns the bundled sage-statusline.cjs as a child process with a fake HOME
 * to verify that uninstall/disable cleanup works correctly.
 *
 * NOTE: The script resolves its plugin root via __dirname and compares it
 * against ~/.claude/ to decide whether it's a marketplace install. Cleanup
 * tests copy the bundle under tmpHome/.claude/plugins/ so the check passes.
 * The --plugin-dir test uses the repo path directly.
 */

import { execFile } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { makeTmpDir } from "../../../core/src/__tests__/test-utils.js";

const STATUSLINE_SCRIPT = resolve(__dirname, "..", "..", "dist", "sage-statusline.cjs");
const PLUGIN_NAME = "sage";

/**
 * Copy the bundled script under tmpHome/.claude/plugins/sage/ so that
 * isMarketplaceInstallation() returns true (plugin root starts with ~/.claude/).
 */
function setupMarketplaceScript(tmpHome: string): string {
	const marketplaceRoot = join(tmpHome, ".claude", "plugins", "sage");
	const distDir = join(marketplaceRoot, "packages", "claude-code", "dist");
	mkdirSync(distDir, { recursive: true });

	const scriptDest = join(distDir, "sage-statusline.cjs");
	copyFileSync(STATUSLINE_SCRIPT, scriptDest);

	mkdirSync(join(marketplaceRoot, ".claude-plugin"), { recursive: true });
	writeFileSync(
		join(marketplaceRoot, ".claude-plugin", "plugin.json"),
		JSON.stringify({ name: PLUGIN_NAME }),
	);

	return scriptDest;
}

function runStatusLine(
	input: Record<string, unknown> | string,
	env: Record<string, string>,
	script = STATUSLINE_SCRIPT,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
	return new Promise((resolve) => {
		const child = execFile(
			"node",
			[script],
			{ timeout: 10_000, env: { ...process.env, ...env } },
			(error, stdout, stderr) => {
				resolve({ stdout, stderr, code: error?.code ? Number(error.code) : child.exitCode });
			},
		);
		const stdin = typeof input === "string" ? input : JSON.stringify(input);
		child.stdin?.end(stdin);
	});
}

function setupHome(
	tmpHome: string,
	options: {
		pluginInstalled?: boolean;
		pluginEnabled?: boolean;
		statusLine?: boolean;
		statusFiles?: string[];
	} = {},
): void {
	const {
		pluginInstalled = true,
		pluginEnabled = true,
		statusLine = true,
		statusFiles = [],
	} = options;

	// Plugin registry
	mkdirSync(join(tmpHome, ".claude", "plugins"), { recursive: true });
	const plugins: Record<string, unknown> = {};
	if (pluginInstalled) {
		plugins[`${PLUGIN_NAME}@some-source`] = [{ installPath: "/tmp/sage", version: "1.0.0" }];
	}
	writeFileSync(
		join(tmpHome, ".claude", "plugins", "installed_plugins.json"),
		JSON.stringify({ version: "1", plugins }),
	);

	// Settings with statusLine and enabledPlugins
	const settings: Record<string, unknown> = {};
	if (statusLine) {
		settings.statusLine = {
			command: "node /path/to/sage-statusline.cjs",
		};
	}
	if (!pluginEnabled) {
		settings.enabledPlugins = { [`${PLUGIN_NAME}@some-source`]: false };
	}
	writeFileSync(join(tmpHome, ".claude", "settings.json"), JSON.stringify(settings, null, 2));

	// Status files
	if (statusFiles.length > 0) {
		mkdirSync(join(tmpHome, ".sage"), { recursive: true });
		for (const sessionId of statusFiles) {
			writeFileSync(
				join(tmpHome, ".sage", `statusline-${sessionId}.txt`),
				JSON.stringify({ denied: 1, flagged: 0, lastReason: "test", lastCategory: "test" }),
			);
		}
	}
}

function readSettings(tmpHome: string): Record<string, unknown> {
	return JSON.parse(readFileSync(join(tmpHome, ".claude", "settings.json"), "utf-8"));
}

function statusFileExists(tmpHome: string, sessionId: string): boolean {
	try {
		readFileSync(join(tmpHome, ".sage", `statusline-${sessionId}.txt`));
		return true;
	} catch {
		return false;
	}
}

describe("sage-statusline cleanup", () => {
	let tmpHome: string;

	beforeEach(async () => {
		tmpHome = await makeTmpDir();
	});

	it("removes statusLine when plugin is disabled (no sessionId)", async () => {
		const script = setupMarketplaceScript(tmpHome);
		setupHome(tmpHome, { pluginEnabled: false, statusLine: true });

		const { stdout, code } = await runStatusLine("", { HOME: tmpHome }, script);

		expect(code).toBe(0);
		expect(stdout).toBe("");
		expect(readSettings(tmpHome)).not.toHaveProperty("statusLine");
	}, 10_000);

	it("removes statusLine when plugin is disabled (with sessionId and status file)", async () => {
		const script = setupMarketplaceScript(tmpHome);
		setupHome(tmpHome, {
			pluginEnabled: false,
			statusLine: true,
			statusFiles: ["sess1"],
		});

		const { stdout, code } = await runStatusLine(
			{ session_id: "sess1" },
			{ HOME: tmpHome },
			script,
		);

		expect(code).toBe(0);
		expect(stdout).toBe("");
		expect(readSettings(tmpHome)).not.toHaveProperty("statusLine");
	}, 10_000);

	it("prunes status files on successful cleanup", async () => {
		const script = setupMarketplaceScript(tmpHome);
		setupHome(tmpHome, {
			pluginEnabled: false,
			statusLine: true,
			statusFiles: ["sess1", "sess2"],
		});

		await runStatusLine("", { HOME: tmpHome }, script);

		expect(statusFileExists(tmpHome, "sess1")).toBe(false);
		expect(statusFileExists(tmpHome, "sess2")).toBe(false);
	}, 10_000);

	it("does not prune status files when statusLine removal fails", async () => {
		const script = setupMarketplaceScript(tmpHome);
		setupHome(tmpHome, {
			pluginEnabled: false,
			statusLine: true,
			statusFiles: ["sess1"],
		});
		// Delete settings.json so removeOwnStatusLine fails with ENOENT
		const { unlinkSync } = await import("node:fs");
		unlinkSync(join(tmpHome, ".claude", "settings.json"));

		const { code } = await runStatusLine("", { HOME: tmpHome }, script);

		expect(code).toBe(0);
		expect(statusFileExists(tmpHome, "sess1")).toBe(true);
	}, 10_000);

	it("outputs status when plugin is installed and enabled (with sessionId)", async () => {
		setupHome(tmpHome, {
			pluginInstalled: true,
			pluginEnabled: true,
			statusLine: true,
			statusFiles: ["sess1"],
		});

		const { stdout, code } = await runStatusLine({ session_id: "sess1" }, { HOME: tmpHome });

		expect(code).toBe(0);
		expect(stdout).toContain("blocked");
		expect(readSettings(tmpHome)).toHaveProperty("statusLine");
	}, 10_000);

	it("outputs fallback status when plugin is installed but no sessionId", async () => {
		setupHome(tmpHome, { pluginInstalled: true, statusLine: true });

		const { stdout, code } = await runStatusLine("", { HOME: tmpHome });

		expect(code).toBe(0);
		expect(stdout).toContain("✅");
		expect(readSettings(tmpHome)).toHaveProperty("statusLine");
	}, 10_000);

	it("shows fallback when status file is missing (startup race or stale --plugin-dir)", async () => {
		setupHome(tmpHome, { pluginInstalled: false, statusLine: true });

		const { stdout, code } = await runStatusLine({ session_id: "nonexistent" }, { HOME: tmpHome });

		expect(code).toBe(0);
		expect(stdout).toContain("✅");
		expect(readSettings(tmpHome)).toHaveProperty("statusLine");
	}, 10_000);

	it("does not touch settings when plugin is installed and enabled", async () => {
		setupHome(tmpHome, { pluginInstalled: true, statusLine: true, statusFiles: ["sess1"] });
		const before = readFileSync(join(tmpHome, ".claude", "settings.json"), "utf-8");

		await runStatusLine({ session_id: "sess1" }, { HOME: tmpHome });

		const after = readFileSync(join(tmpHome, ".claude", "settings.json"), "utf-8");
		expect(after).toBe(before);
	}, 10_000);

	it("does not clean up when plugin is not in registry but loaded via --plugin-dir", async () => {
		setupHome(tmpHome, { pluginInstalled: false, statusLine: true });

		const { stdout, code } = await runStatusLine("", { HOME: tmpHome });

		expect(code).toBe(0);
		expect(stdout).toContain("✅");
		expect(readSettings(tmpHome)).toHaveProperty("statusLine");
	}, 10_000);
});
