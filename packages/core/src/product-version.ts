/**
 * Platform-agnostic reader for the `version` field in a host's `product.json`.
 *
 * Both Cursor and VS Code ship a `product.json` at their application root with
 * a top-level `"version"` field that identifies the host application:
 *
 * - Cursor: e.g. `"3.1.14"` — the actual Cursor version (NOT the `vscode.version`
 *   value, which returns the underlying VS Code engine version baked into the
 *   Electron shell, e.g. `"1.96.0"`).
 * - VS Code: e.g. `"1.117.0-insider"` — equals `vscode.version` for VS Code hosts.
 *
 * This helper has no dependency on the `vscode` module and uses only Node.js
 * built-ins (`fs`, `path`), so it is safe to call from any package in the
 * monorepo — extension host, hook runner child process, MCP server, SEA
 * binaries — wherever an absolute `appRoot` path is available.
 *
 * Inside the extension host the path comes from `vscode.env.appRoot`; child
 * processes receive it via the `SAGE_APP_ROOT` environment variable injected
 * by the extension at hook-shim install time and at MCP server registration
 * (so the same value is used by both transport channels).
 *
 * Fail-open: returns `"unknown"` on any error (missing file, unreadable, parse
 * failure, missing `version` field, wrong type). Reporting `vscode.version` for
 * a Cursor child process — which is what the previous code path did — would be
 * actively misleading; `"unknown"` is the safer default.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

export function readProductJsonVersion(appRoot: string): string {
	if (!appRoot) return "unknown";
	try {
		const productJsonPath = path.join(appRoot, "product.json");
		const raw = readFileSync(productJsonPath, "utf8");
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const version = parsed.version;
		if (typeof version === "string" && version.length > 0) {
			return version;
		}
		return "unknown";
	} catch {
		return "unknown";
	}
}
