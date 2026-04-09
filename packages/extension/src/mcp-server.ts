#!/usr/bin/env node

import { loadBrandingSync, nullLogger } from "@gendigital/sage-core";
import { runSageMcpServerStdio } from "@gendigital/sage-mcp";

declare const __SAGE_VERSION__: string;

const branding = loadBrandingSync();

async function main(): Promise<void> {
	await runSageMcpServerStdio({
		version: __SAGE_VERSION__,
		logger: nullLogger,
		branding,
	});
}

main().catch((e) => {
	process.stderr.write(`${branding.product_name} MCP server failed: ${String(e)}\n`);
	process.exit(1);
});
