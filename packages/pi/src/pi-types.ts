/**
 * Minimal structural types for pi's extension API.
 *
 * Mirrors the subset of `ExtensionAPI` declared in pi's
 * `packages/coding-agent/src/core/extensions/types.ts` (1.0.4) that this
 * package uses, with no runtime dependency on pi packages. The handler
 * registration surface is shared with the OMP connector and lives in
 * sage-core. pi's `ExtensionAPI` has no logger; sage logs through its own
 * operational log.
 */

import type { HookHostAPI } from "@gendigital/sage-core";

export type ExtensionAPI = HookHostAPI;

/** Default export of a pi extension module. */
export type ExtensionFactory = (pi: ExtensionAPI) => void;
