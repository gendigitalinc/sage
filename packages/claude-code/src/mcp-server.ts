#!/usr/bin/env node

/**
 * Sage MCP server for Claude Code.
 * Provides Sage MCP tools, including:
 * - sage_report_false_positive / sage_list_audit_entries (audit log reporting)
 */

import type { Logger } from "@gendigital/sage-core";
import { runSageMcpServerStdio } from "@gendigital/sage-mcp";
import pino from "pino";

const logger: Logger = pino({ level: "warn" }, pino.destination(2));

declare const __SAGE_VERSION__: string;

async function main(): Promise<void> {
	await runSageMcpServerStdio({
		version: __SAGE_VERSION__,
		logger,
	});
}

main().catch((e) => {
	logger.error("MCP server failed", { error: String(e) });
	process.exit(1);
});
