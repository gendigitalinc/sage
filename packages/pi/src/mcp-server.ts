#!/usr/bin/env node

/**
 * Sage MCP server for pi (sage_report_false_positive / sage_list_audit_entries),
 * registered by the extension via `pi.registerMcpServer("sage", …)`.
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
	logger = createOperationalLogger(config.operational_logging, "pi").forComponent("mcp-server");
	const branding = resolveBranding(config.brand_key, logger);

	await runSageMcpServerStdio({
		version: __SAGE_VERSION__,
		logger,
		branding,
	});
}

main().catch(async (error) => {
	logger.error("MCP server failed", { error: String(error) });
	await logger.flush?.();
	process.exit(1);
});
