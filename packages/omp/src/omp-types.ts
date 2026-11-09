/**
 * Minimal structural types for Oh My Pi hook API compatibility.
 *
 * These mirror the shapes declared in OMP's
 * `packages/coding-agent/src/extensibility/hooks/types.ts` but carry no
 * runtime dependency on oh-my-pi packages — OMP's extension runner binds the
 * default-exported factory (`--hook` is an alias for `--extension`), and
 * handlers receive objects whose shapes match these interfaces. The handler
 * registration surface is shared with the pi connector and lives in sage-core.
 *
 * Keep this file narrow: declare only the surface this package actually uses.
 */

import type { HookHostAPI } from "@gendigital/sage-hook-host";

/**
 * Subset of OMP's pi-utils logger namespace this package calls. OMP 18.12
 * (the minimum this connector targets) exports `info`.
 */
export interface HookLogger {
	debug(msg: string, data?: Record<string, unknown>): void;
	info(msg: string, data?: Record<string, unknown>): void;
	warn(msg: string, data?: Record<string, unknown>): void;
	error(msg: string, data?: Record<string, unknown>): void;
}

/** Hook API provided by Oh My Pi's hook loader. */
export interface HookAPI extends HookHostAPI {
	logger: HookLogger;
}

/** Factory function exported as default from a hook module. */
export type HookFactory = (pi: HookAPI) => void;
