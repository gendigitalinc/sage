/**
 * Minimal structural types for pi's extension API.
 *
 * Mirrors the subset of `ExtensionAPI` declared in pi's
 * `packages/coding-agent/src/core/extensions/types.ts` (1.3.0) that this
 * package uses, with no runtime dependency on pi packages. The handler
 * registration surface is shared with the OMP connector and lives in
 * sage-core. pi's `ExtensionAPI` has no logger; sage logs through its own
 * operational log.
 */

import type { HookHostAPI, HookUI } from "@gendigital/sage-hook-host";

/** `sourceInfo` as exposed by pi's `getAllTools()` / `getCommands()`. */
export interface PiSourceInfo {
	path: string;
	source: string;
	scope: "user" | "project" | "temporary";
	origin: "package" | "top-level";
	baseDir?: string;
}

/** Same config shape as an `mcpServers` entry in pi's `mcp.json` (stdio form). */
export interface PiMcpServerConfig {
	command: string;
	args?: string[];
	env?: Record<string, string>;
}

/**
 * The subset of pi's `ExtensionAPI` this package uses beyond the shared hook
 * surface. Optional so the extension still loads on a pi build that lacks one
 * (each call site is guarded and fail-open).
 */
export interface ExtensionAPI extends HookHostAPI {
	getAllTools?(): Array<{ sourceInfo: PiSourceInfo }>;
	getCommands?(): Array<{ sourceInfo: PiSourceInfo }>;
	registerMcpServer?(name: string, config: PiMcpServerConfig): void;
}

/** pi's dialog UI plus `notify`, used to surface session-scan findings. */
export interface PiUI extends HookUI {
	notify?(message: string, type?: "info" | "warning" | "error"): void;
}

/** Default export of a pi extension module. */
export type ExtensionFactory = (pi: ExtensionAPI) => void;
