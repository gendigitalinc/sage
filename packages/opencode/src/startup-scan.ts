/**
 * Startup and session scan handlers for OpenCode.
 * Thin wrapper over core's createScanHandler.
 */

import { createRequire } from "node:module";
import {
	type Branding,
	createScanHandler as coreScanHandler,
	defaultBranding,
	type Logger,
} from "@gendigital/sage-core";
import { getBundledDataDirs, getSageVersion } from "./bundled-dirs.js";
import { discoverOpenCodePlugins } from "./plugin-discovery.js";

/**
 * OpenCode is published as an unbundled ESM plugin (tsc only). The model
 * download worker therefore lives in the `@gendigital/sage-core` package
 * as `dist/model-download-worker.js`. Resolve via `require.resolve` so we
 * pick it up wherever pnpm/node placed it.
 */
function resolveModelDownloadWorkerPath(): string | undefined {
	try {
		const req = createRequire(import.meta.url);
		return req.resolve("@gendigital/sage-core/dist/model-download-worker.js");
	} catch {
		return undefined;
	}
}

export function createSessionScanHandler(
	logger: Logger,
	projectDir?: string,
	onResult?: (msg: string) => void,
	branding: Branding = defaultBranding,
): () => Promise<void> {
	const { threatsDir, allowlistsDir } = getBundledDataDirs();
	const version = getSageVersion();

	return coreScanHandler({
		logger,
		context: "session",
		discoverPlugins: () => discoverOpenCodePlugins(logger, projectDir, branding),
		selfPrefix: "@gendigital/sage-opencode@",
		threatsDir,
		allowlistsDir,
		version,
		agentRuntime: "opencode",
		branding,
		onResult,
		modelDownloadWorkerPath: resolveModelDownloadWorkerPath(),
	});
}
