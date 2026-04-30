/**
 * Generic scan orchestration for all connectors.
 * Extracts the common runScan + createScanHandler pattern from
 * OpenCode/OpenClaw startup-scan files.
 */

import { defaultBranding } from "./brands.js";
import { formatSessionStartMessage, type ThreatBannerStyle } from "./format.js";
import { runSessionStart } from "./session-start.js";
import type { AgentRuntime, Branding, Logger, PluginInfo } from "./types.js";

/**
 * Run a plugin scan with the given plugins and return a formatted status message.
 * Always returns a message (clean or findings) — callers can always show the result.
 *
 * `style` controls the threat-banner layout and defaults to `"verbose"` for
 * backwards compatibility with existing CLI hosts (Claude Code, OpenClaw).
 * IDE connectors that surface the result through a small toast (Cursor /
 * VS Code) should pass `"compact"`.
 */
export async function runPluginScan(
	logger: Logger,
	context: string,
	plugins: PluginInfo[],
	threatsDir: string,
	allowlistsDir: string,
	version: string,
	agentRuntime: AgentRuntime,
	branding: Branding = defaultBranding,
	modelDownloadWorkerPath?: string,
	style: ThreatBannerStyle = "verbose",
): Promise<string> {
	logger.info(`${branding.name} plugin scan started (${context})`, {
		threatsDir,
		allowlistsDir,
	});

	const result = await runSessionStart({
		plugins,
		threatsDir,
		allowlistsDir,
		version,
		logger,
		agentRuntime,
		modelDownloadWorkerPath,
	});

	logger.info(`${branding.name} plugin scan (${context}) complete`, {
		findings: result.scanResults.length,
		updateAvailable: result.versionCheck?.updateAvailable ?? false,
	});

	return formatSessionStartMessage(version, result, branding, style);
}

/**
 * Convenience wrapper for in-process connectors: discovery + self-filter + scan + error handling.
 */
export interface ScanHandlerOptions {
	logger: Logger;
	context: string;
	discoverPlugins: () => Promise<PluginInfo[]>;
	selfPrefix: string;
	threatsDir: string;
	allowlistsDir: string;
	version: string;
	agentRuntime: AgentRuntime;
	branding?: Branding;
	onResult?: (msg: string) => void;
	/** Connector-bundled `dist/model-download-worker.cjs` (see runSessionStart). */
	modelDownloadWorkerPath?: string;
	/** Threat-banner style passed through to `runPluginScan`. Defaults to verbose. */
	style?: ThreatBannerStyle;
}

export function createScanHandler(options: ScanHandlerOptions): () => Promise<void> {
	const {
		logger,
		context,
		discoverPlugins,
		selfPrefix,
		threatsDir,
		allowlistsDir,
		version,
		agentRuntime,
		branding = defaultBranding,
		onResult,
		modelDownloadWorkerPath,
		style = "verbose",
	} = options;

	return async () => {
		try {
			let plugins = await discoverPlugins();
			plugins = plugins.filter((p) => !p.key.startsWith(selfPrefix));

			if (plugins.length === 0) {
				logger.warn(
					`${branding.name} plugin scan (${context}): no plugins to scan after filtering`,
				);
			}

			const msg = await runPluginScan(
				logger,
				context,
				plugins,
				threatsDir,
				allowlistsDir,
				version,
				agentRuntime,
				branding,
				modelDownloadWorkerPath,
				style,
			);
			onResult?.(msg);
		} catch (e) {
			logger.error(`${branding.name} ${context} scan failed`, { error: String(e) });
		}
	};
}
