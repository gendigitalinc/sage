#!/usr/bin/env node

/**
 * Sage MCP server for OpenCode.
 * Provides Sage MCP tools, including:
 * - sage_report_false_positive / sage_list_audit_entries (audit log reporting)
 */

import {
	createOperationalLogger,
	type Logger,
	loadConfig,
	nullLogger,
	resolveBranding,
} from "@gendigital/sage-core";
import { runSageMcpServerStdio } from "@gendigital/sage-mcp";

let logger: Logger = nullLogger;

declare const __SAGE_VERSION__: string;

async function main(): Promise<void> {
	const config = await loadConfig();
	logger = createOperationalLogger(config.operational_logging, "opencode").forComponent(
		"mcp-server",
	);
	const branding = resolveBranding(config.brand_key, logger);

	await runSageMcpServerStdio({
		version: __SAGE_VERSION__,
		logger,
		branding,
	});
}

main().catch(async (e) => {
	logger.error("MCP server failed", { error: String(e) });
	await logger.flush?.();
	process.exit(1);
});
