import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

declare const __SAGE_VERSION__: string;

function resolveVersion(): string {
	if (typeof __SAGE_VERSION__ !== "undefined") return __SAGE_VERSION__;

	try {
		const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
		if (typeof pkg.version === "string") return pkg.version;
	} catch {
		// package.json not found or unreadable
	}

	return "dev";
}

export const VERSION: string = resolveVersion();
