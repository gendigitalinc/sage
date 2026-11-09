/**
 * Threat / trusted-domain resource lookup shared by the pi and OMP connectors.
 *
 * Packed installs ship `resources/` (copied at pack time by
 * `scripts/sync-connector-assets.mjs`); in the monorepo it is absent, so the
 * files are read straight from the repo root.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface ConnectorResources {
	/** True when the packed `resources/` copy is present. */
	bundled: boolean;
	threatsDir: string;
	trustedDomainsDir: string;
	/** True when neither source exists, so no rules load. Connectors warn on it. */
	missing: boolean;
}

/** Resolves resource dirs for a connector whose bundle lives in `<packageRoot>/dist`. */
export function resolveConnectorResources(packageRoot: string): ConnectorResources {
	const bundled = existsSync(resolve(packageRoot, "resources", "threats"));
	const repoRoot = resolve(packageRoot, "..", "..");
	const threatsDir = bundled
		? resolve(packageRoot, "resources", "threats")
		: resolve(repoRoot, "threats");
	const trustedDomainsDir = bundled
		? resolve(packageRoot, "resources", "trusted-domains")
		: resolve(repoRoot, "trusted-domains");
	return { bundled, threatsDir, trustedDomainsDir, missing: !existsSync(threatsDir) };
}
