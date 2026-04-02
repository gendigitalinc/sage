import type { Logger } from "@gendigital/sage-core";
import { nullLogger } from "@gendigital/sage-core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerFalsePositiveTools } from "./tools/false-positive.js";

export interface SageMcpServerOptions {
	name?: string;
	version: string;
	logger?: Logger;
}

export function createSageMcpServer(options: SageMcpServerOptions): McpServer {
	const logger = options.logger ?? nullLogger;
	const server = new McpServer({
		name: options.name ?? "sage",
		version: options.version,
	});

	registerFalsePositiveTools(server, { logger, versionApp: options.version });

	return server;
}

export async function runSageMcpServerStdio(options: SageMcpServerOptions): Promise<void> {
	const server = createSageMcpServer(options);
	const transport = new StdioServerTransport();
	await server.connect(transport);
}
