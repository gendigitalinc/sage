#!/usr/bin/env node

import { loadConfigSync, nullLogger, resolveBranding } from "@gendigital/sage-core";
import { runSageMcpServerStdio } from "@gendigital/sage-mcp";

declare const __SAGE_VERSION__: string;

const config = loadConfigSync();
const branding = resolveBranding(config.brand_key);

async function main(): Promise<void> {
	await runSageMcpServerStdio({
		version: __SAGE_VERSION__,
		logger: nullLogger,
		branding,
	});
}

main().catch((e) => {
	process.stderr.write(`${branding.name} MCP server failed: ${String(e)}\n`);
	process.exit(1);
});
