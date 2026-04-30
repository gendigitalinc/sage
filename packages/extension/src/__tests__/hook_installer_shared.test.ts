import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({}));

import { assertSafePathForShim, createHookShim } from "../hook_installer_shared.js";

describe("createHookShim", () => {
	let hooksDir: string;

	beforeEach(async () => {
		hooksDir = await mkdtemp(path.join(tmpdir(), "sage-shim-"));
	});

	afterEach(async () => {
		await rm(hooksDir, { recursive: true, force: true });
	});

	it("writes SAGE_APP_ROOT into the POSIX shim alongside ELECTRON_RUN_AS_NODE", async () => {
		await createHookShim(hooksDir, "/usr/bin/node", "/opt/runner.cjs", "/opt/cursor/resources/app");

		const posix = await readFile(path.join(hooksDir, "sage-hook"), "utf8");
		expect(posix).toContain("export ELECTRON_RUN_AS_NODE=1");
		expect(posix).toContain('export SAGE_APP_ROOT="/opt/cursor/resources/app"');
		expect(posix).toContain('"/usr/bin/node" "/opt/runner.cjs" "$@"');
	});

	it("writes SAGE_APP_ROOT into the Windows shim alongside ELECTRON_RUN_AS_NODE", async () => {
		await createHookShim(
			hooksDir,
			"C:\\Program Files\\nodejs\\node.exe",
			"C:\\plugin\\runner.cjs",
			"C:\\Users\\u\\AppData\\Local\\Programs\\cursor\\resources\\app",
		);

		const cmd = await readFile(path.join(hooksDir, "sage-hook.cmd"), "utf8");
		expect(cmd).toContain("set ELECTRON_RUN_AS_NODE=1");
		expect(cmd).toContain(
			"set SAGE_APP_ROOT=C:\\Users\\u\\AppData\\Local\\Programs\\cursor\\resources\\app",
		);
	});

	it("emits SAGE_APP_ROOT before the runner invocation so the env applies to the child", async () => {
		await createHookShim(hooksDir, "/usr/bin/node", "/opt/runner.cjs", "/opt/cursor");

		const posix = await readFile(path.join(hooksDir, "sage-hook"), "utf8");
		const setIdx = posix.indexOf("export SAGE_APP_ROOT=");
		const runIdx = posix.indexOf('"/usr/bin/node"');
		expect(setIdx).toBeGreaterThan(0);
		expect(runIdx).toBeGreaterThan(setIdx);
	});

	it("rejects an empty appRoot via the same shell-injection guard as nodePath/runnerPath", async () => {
		await expect(createHookShim(hooksDir, "/usr/bin/node", "/opt/runner.cjs", "")).rejects.toThrow(
			/App root path is empty/,
		);
	});

	it("rejects an appRoot that contains shell-unsafe characters", async () => {
		await expect(
			createHookShim(hooksDir, "/usr/bin/node", "/opt/runner.cjs", '/tmp/"; rm -rf /; #'),
		).rejects.toThrow(/App root path contains unsupported characters/);
	});

	it("uses the same guard helper that protects nodePath / runnerPath", () => {
		expect(() => assertSafePathForShim('"; evil', "App root")).toThrow(
			/App root path contains unsupported characters/,
		);
		expect(() => assertSafePathForShim("/safe/path", "App root")).not.toThrow();
	});
});
