/**
 * Startup and session scan handlers for OpenClaw.
 * Thin wrappers over core's createScanHandler.
 */

import { resolve } from "node:path";
import {
	type Branding,
	createScanHandler as coreScanHandler,
	defaultBranding,
	type Logger,
} from "@gendigital/sage-core";
import { getBundledDataDirs, getSageVersion } from "./bundled-dirs.js";
import { discoverOpenClawPlugins } from "./plugin-discovery.js";

function createOpenClawScanHandler(
	logger: Logger,
	context: string,
	branding: Branding = defaultBranding,
	onResult?: (msg: string) => void,
): () => Promise<void> {
	const { threatsDir, allowlistsDir } = getBundledDataDirs();
	const version = getSageVersion();

	return coreScanHandler({
		logger,
		context,
		discoverPlugins: () => discoverOpenClawPlugins(logger, undefined, branding),
		selfPrefix: "@gendigital/sage-openclaw@",
		threatsDir,
		allowlistsDir,
		version,
		agentRuntime: "openclaw",
		branding,
		onResult,
		modelDownloadWorkerPath: resolve(__dirname, "model-download-worker.cjs"),
	});
}

export function createStartupScanHandler(
	logger: Logger,
	branding: Branding = defaultBranding,
	onResult?: (msg: string) => void,
): () => Promise<void> {
	return createOpenClawScanHandler(logger, "startup", branding, onResult);
}

export function createSessionScanHandler(
	logger: Logger,
	branding: Branding = defaultBranding,
	onResult?: (msg: string) => void,
): () => Promise<void> {
	return createOpenClawScanHandler(logger, "session", branding, onResult);
}

/**
 * Creates a before_agent_start handler that surfaces plugin scan findings
 * as prepended context. One-shot: clears findings after first delivery.
 */
export function createBeforeAgentStartHandler(
	getFindings: () => string | null,
	clearFindings: () => void,
	logger: Logger,
	branding: Branding = defaultBranding,
): () => { prependContext: string } | undefined {
	return () => {
		const findings = getFindings();
		if (!findings) return undefined;

		clearFindings();
		logger.debug(`${branding.name}: surfacing plugin scan findings via before_agent_start`);

		const prependContext = [
			'<security-alert source="sage-plugin-scan">',
			findings,
			"",
			"Inform the user about these security findings.",
			"</security-alert>",
		].join("\n");

		return { prependContext };
	};
}
