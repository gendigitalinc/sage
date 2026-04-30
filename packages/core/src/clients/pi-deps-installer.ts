/**
 * On-demand installer for PI check runtime dependencies.
 *
 * WHY THIS EXISTS:
 * onnxruntime-node is a native C++ addon (~30MB per platform) that cannot be
 * bundled into the Cursor/VS Code VSIX. For Claude Code, it is installed as an
 * optional dependency via pnpm. For Cursor, it must be downloaded on first use.
 *
 * WHAT IT DOES:
 * 1. Checks if onnxruntime-node exists in the model directory's node_modules
 * 2. Checks if it's available via the workspace (monorepo/optional deps)
 * 3. Falls back to `npm install --no-save` into the model directory (one-time)
 *
 * SECURITY NOTE:
 * Running `npm install` at runtime is intentional for the Cursor VSIX scenario
 * where native deps cannot be pre-bundled. The install targets only
 * onnxruntime-node from the configured npm registry. This only runs when
 * pi_check is explicitly enabled in config. Fails open with a warning if
 * installation fails (no internet, read-only filesystem, etc).
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, sep } from "node:path";
import type { Logger } from "../types.js";
import { nullLogger } from "../types.js";

const REQUIRED_PACKAGES = ["onnxruntime-node"];

/**
 * True iff every required package is resolvable from the model
 * directory's node_modules — not just present on disk.
 */
export function isLocalInstallValid(modelPath: string): boolean {
	try {
		const req = createRequire(resolve(modelPath, "package.json"));
		const localPrefix = realpathSync(resolve(modelPath, "node_modules")) + sep;
		for (const pkg of REQUIRED_PACKAGES) {
			const resolved = req.resolve(pkg);
			// Reject resolutions outside model-local node_modules
			// (createRequire walks up the directory tree)
			if (!resolved.startsWith(localPrefix)) return false;
		}
		return true;
	} catch {
		return false;
	}
}

/**
 * Ensure PI runtime deps are available.
 * First tries to require from the model directory's node_modules,
 * then from the regular module resolution path (workspace root).
 * Only falls back to npm install if neither works.
 * Returns true if deps are available, false if not.
 */
export async function ensurePiDeps(
	modelPath: string,
	logger: Logger = nullLogger,
): Promise<boolean> {
	// 1. Check model-local node_modules (previous on-demand install)
	if (isLocalInstallValid(modelPath)) return true;

	// 2. Check if available via normal module resolution (workspace/optional deps)
	try {
		require.resolve("onnxruntime-node");
		return true;
	} catch {
		// Not available via workspace — need on-demand install
	}

	// 3. On-demand install (Cursor VSIX scenario — no bundled native deps)
	logger.info("Installing PI runtime dependencies (first-time setup)...");

	try {
		const pkgJsonPath = resolve(modelPath, "package.json");
		if (!existsSync(pkgJsonPath)) {
			mkdirSync(modelPath, { recursive: true });
			writeFileSync(pkgJsonPath, '{"private":true}');
		}

		await runNpm(modelPath, ["install", "--no-save", ...REQUIRED_PACKAGES], logger);

		const verified = isLocalInstallValid(modelPath);

		if (verified) {
			logger.info("PI runtime dependencies installed successfully");
		} else {
			logger.warn("PI dependency installation may be incomplete");
		}

		return verified;
	} catch (err) {
		logger.warn(
			`Failed to install PI dependencies (PI check will be skipped): ${err instanceof Error ? err.message : String(err)}`,
		);
		return false;
	}
}

function runNpm(cwd: string, args: string[], logger: Logger): Promise<void> {
	return new Promise((resolve, reject) => {
		const isWindows = process.platform === "win32";
		const npmCmd = isWindows ? "npm.cmd" : "npm";
		// Since Node 18.20.2 / 20.12.2 / 21.7.3 (CVE-2024-27980), spawning a
		// .cmd/.bat on Windows requires shell:true or it throws EINVAL before
		// the process starts. Args here are static (REQUIRED_PACKAGES is a
		// hard-coded constant in this module), so there's no injection vector.
		const child = execFile(
			npmCmd,
			args,
			{ cwd, timeout: 30_000, shell: isWindows },
			(error, _stdout, stderr) => {
				if (error) {
					logger.warn(`npm install error: ${stderr || error.message}`);
					reject(error);
				} else {
					resolve();
				}
			},
		);
		child.unref();
	});
}
