/**
 * Resolves bundled resource directories and package metadata.
 * When bundled by esbuild, __dirname points to packages/openclaw/dist/,
 * and resources are at packages/openclaw/resources/ (one level up).
 */

import { join, resolve } from "node:path";
import { getFileContentSync } from "@gendigital/sage-core";

const packageRoot = resolve(__dirname, "..");

export function getBundledDataDirs(): { threatsDir: string; allowlistsDir: string } {
	return {
		threatsDir: join(packageRoot, "resources", "threats"),
		allowlistsDir: join(packageRoot, "resources", "allowlists"),
	};
}

let cachedVersion: string | undefined;

export function getSageVersion(): string {
	if (cachedVersion) return cachedVersion;
	try {
		const pkg = JSON.parse(getFileContentSync(join(packageRoot, "package.json"), "utf-8"));
		cachedVersion = (pkg.version as string) ?? "0.0.0";
	} catch {
		cachedVersion = "0.0.0";
	}
	return cachedVersion;
}
