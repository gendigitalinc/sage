/**
 * Startup and session scan handlers for OpenCode.
 * Thin wrapper over core's createScanHandler.
 */

import {
	type Branding,
	createScanHandler as coreScanHandler,
	defaultBranding,
	type Logger,
} from "@gendigital/sage-core";
import { getBundledDataDirs, getSageVersion } from "./bundled-dirs.js";
import { discoverOpenCodePlugins } from "./plugin-discovery.js";

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
	});
}
