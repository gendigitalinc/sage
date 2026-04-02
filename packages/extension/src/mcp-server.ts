#!/usr/bin/env node

import { nullLogger } from "@gendigital/sage-core";
import { runSageMcpServerStdio } from "@gendigital/sage-mcp";

declare const __SAGE_VERSION__: string;

async function main(): Promise<void> {
	await runSageMcpServerStdio({
		version: __SAGE_VERSION__,
		logger: nullLogger,
	});
}

main().catch((e) => {
	process.stderr.write(`Sage MCP server failed: ${String(e)}\n`);
	process.exit(1);
});
