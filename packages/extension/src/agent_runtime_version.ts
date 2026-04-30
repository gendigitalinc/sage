/**
 * Host-aware resolver for the agent runtime version reported in telemetry.
 *
 * Lives in the extension package because it depends on the `vscode` API. Core
 * cannot import `vscode` (it must remain platform-agnostic so it works inside
 * Claude Code hooks, the standalone MCP server, and SEA binaries).
 *
 * - Cursor: read the `version` field from `product.json` at `vscode.env.appRoot`
 *   (e.g. `"3.1.14"`). Calling `vscode.version` for a Cursor host would return
 *   the underlying VS Code engine version (e.g. `"1.96.0"`) baked into Cursor's
 *   Electron shell, which is misleading.
 * - VS Code: prefer `vscode.version` (e.g. `"1.117.0-insider"`); this is the
 *   canonical value in the extension host.
 * - Anything else: `"unknown"`.
 *
 * Fail-open: if the Cursor `product.json` is missing or unreadable, returns
 * `"unknown"` rather than falling back to `vscode.version`.
 */

import { readProductJsonVersion } from "@gendigital/sage-core";
import * as vscode from "vscode";

export function resolveAgentRuntimeVersion(agentRuntime: "cursor" | "vscode" | string): string {
	if (agentRuntime === "cursor") {
		return readProductJsonVersion(vscode.env.appRoot);
	}
	if (agentRuntime === "vscode") {
		return vscode.version || "unknown";
	}
	return "unknown";
}
