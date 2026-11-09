/**
 * Session-start scan shared by the pi and OMP connectors: config warnings,
 * allowlist migration, then core's `runPluginScan`. They differ only in which
 * plugins they discover, which is the `plugins` argument.
 */

import {
	type AgentRuntime,
	type Branding,
	checkAllowlistMigration,
	formatAllowlistMigrationWarning,
	formatConfigurationWarnings,
	formatNoticeById,
	getConfigurationWarnings,
	type Logger,
	loadConfig,
	type PluginInfo,
	runPluginScan,
} from "@gendigital/sage-core";

export interface HookSessionScanInput {
	logger: Logger;
	branding: Branding;
	agentRuntime: AgentRuntime;
	agentRuntimeVersion?: string;
	/** Sage product version the update check compares against releases. */
	version: string;
	plugins: PluginInfo[];
	threatsDir: string;
	trustedDomainsDir: string;
	/** Detached workers. An absent path is skipped (fail-open) inside core. */
	modelDownloadWorkerPath?: string;
	skillUploadWorkerPath?: string;
}

/**
 * Runs the scan and returns the user-facing messages, one-time notices first
 * (matching the other connectors). Empty when there is nothing to say.
 */
export async function runHookSessionScan(input: HookSessionScanInput): Promise<string[]> {
	const { logger, branding } = input;
	const config = await loadConfig(undefined, logger);
	const messages: string[] = [];

	const warnings = formatConfigurationWarnings(
		await getConfigurationWarnings(undefined, logger),
		branding,
	);
	if (warnings) messages.push(warnings);

	const migration = await checkAllowlistMigration();
	if (migration.needed) {
		messages.push(formatAllowlistMigrationWarning(migration.entryTypes, branding));
	}

	const notices: string[] = [];
	const scanMessage = await runPluginScan(
		logger,
		"session",
		input.plugins,
		input.threatsDir,
		input.trustedDomainsDir,
		input.version,
		input.agentRuntime,
		branding,
		input.modelDownloadWorkerPath,
		"verbose",
		input.agentRuntimeVersion,
		input.skillUploadWorkerPath,
		(ids) => {
			for (const id of ids) {
				const text = formatNoticeById(id, branding);
				if (text) notices.push(text);
			}
		},
		undefined,
		config.announce_clean_scans,
	);

	return [...notices, ...messages, ...(scanMessage ? [scanMessage] : [])];
}
