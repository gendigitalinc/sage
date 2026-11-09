/** Runtime identity and paths for the pi connector. */

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AgentRuntime } from "@gendigital/sage-core";
import { resolveConnectorResources } from "@gendigital/sage-hook-host";

declare const __SAGE_VERSION__: string;

export const PI_RUNTIME: AgentRuntime = "pi";

/** The bundle lives in `dist/`, so the package root is one level up. */
export const PACKAGE_ROOT = resolve(__dirname, "..");

const RESOURCES = resolveConnectorResources(PACKAGE_ROOT);

/** True when no rules can load; `index.ts` warns (this module has no logger). */
export const RESOURCES_MISSING = RESOURCES.missing;
export const THREATS_DIR = RESOURCES.threatsDir;
export const TRUSTED_DOMAINS_DIR = RESOURCES.trustedDomainsDir;

/** Sage MCP server bundled next to the extension (see esbuild.config.mjs). */
export const MCP_SERVER_PATH = resolve(PACKAGE_ROOT, "dist", "mcp-server.cjs");

/** Detached workers `runSessionStart` spawns. Absent path = skip (fail-open). */
export const MODEL_DOWNLOAD_WORKER_PATH = resolve(
	PACKAGE_ROOT,
	"dist",
	"model-download-worker.cjs",
);
export const SKILL_UPLOAD_WORKER_PATH = resolve(PACKAGE_ROOT, "dist", "skill-upload-worker.cjs");

/**
 * Sage product version (what the update check compares against releases).
 * His version reads the installed sage-core package.json; ours inlines core's
 * version at build time, the same way the OpenCode connector does.
 */
export function getSageVersion(): string {
	return typeof __SAGE_VERSION__ === "string" ? __SAGE_VERSION__ : "0.0.0";
}

/** Package name stamped on pi's own `package.json`. */
export const PI_PACKAGE_NAME = "@earendil-works/pi-coding-agent";

/**
 * pi's runtime version, stamped on audit entries and detection telemetry.
 *
 * pi's package exports only `import` (no `require` condition), so requiring it
 * throws `ERR_PACKAGE_PATH_NOT_EXPORTED`; from the extension folder the same
 * require is `MODULE_NOT_FOUND`. Walk up from the real path of the process
 * entry (`process.argv[1]`, so a symlinked `pi` bin still lands in the
 * package) and read the `package.json` named {@link PI_PACKAGE_NAME}. Anything
 * else — tests, a missing install — returns undefined and telemetry falls
 * back to `SAGE_AGENT_RUNTIME_VERSION`.
 */
export function getPiRuntimeVersion(
	entryPath: string | undefined = process.argv[1],
): string | undefined {
	return readPiPackageVersion(entryPath);
}

/**
 * Walk `start` and its parents for a `package.json` whose `name` is
 * {@link PI_PACKAGE_NAME} and return its `version`. `start` is realpath'd so a
 * symlinked bin resolves into the package, not the link's directory.
 */
export function readPiPackageVersion(start: string | undefined): string | undefined {
	if (!start) return undefined;
	try {
		let dir = dirname(realpathSync(start));
		// Bound the walk: a package.json is never dozens of parents up, and an
		// unbounded loop would spin if realpath ever returned a non-advancing path.
		for (let i = 0; i < 32; i++) {
			const pkgPath = resolve(dir, "package.json");
			if (existsSync(pkgPath)) {
				const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
					name?: unknown;
					version?: unknown;
				};
				if (pkg.name === PI_PACKAGE_NAME) {
					return typeof pkg.version === "string" && pkg.version.length > 0
						? pkg.version
						: undefined;
				}
			}
			const parent = dirname(dir);
			if (parent === dir) return undefined;
			dir = parent;
		}
		return undefined;
	} catch {
		// Not a readable path, or not running inside pi.
		return undefined;
	}
}
