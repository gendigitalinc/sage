#!/usr/bin/env node

import { createOperationalLogger, loadConfigSync, resolveBranding } from "@gendigital/sage-core";
import { runSageMcpServerStdio } from "@gendigital/sage-mcp";

declare const __SAGE_VERSION__: string;

const config = loadConfigSync();
const branding = resolveBranding(config.brand_key);
const runtime = process.env.SAGE_AGENT_RUNTIME === "cursor" ? "cursor" : "vscode";
const logger = createOperationalLogger(config.operational_logging, runtime).forComponent(
	"mcp-server",
);

async function main(): Promise<void> {
	await runSageMcpServerStdio({
		version: __SAGE_VERSION__,
		logger,
		branding,
	});
}

main().catch(async (e) => {
	logger.error("MCP server failed", { error: String(e) });
	await logger.flush?.();
	process.stderr.write(`${branding.name} MCP server failed: ${String(e)}\n`);
	process.exit(1);
});
