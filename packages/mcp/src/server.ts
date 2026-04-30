import { type Branding, defaultBranding, type Logger, nullLogger } from "@gendigital/sage-core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerFalsePositiveTools } from "./tools/false-positive.js";

export interface SageMcpServerOptions {
	name?: string;
	version: string;
	logger?: Logger;
	branding?: Branding;
}

export function createSageMcpServer(options: SageMcpServerOptions): McpServer {
	const logger = options.logger ?? nullLogger;
	const branding = options.branding ?? defaultBranding;
	const server = new McpServer({
		name: options.name ?? branding.name.toLowerCase(),
		version: options.version,
	});

	registerFalsePositiveTools(server, { logger, versionApp: options.version, branding });

	return server;
}

export async function runSageMcpServerStdio(options: SageMcpServerOptions): Promise<void> {
	const branding = options.branding ?? defaultBranding;
	const server = createSageMcpServer({ ...options, branding });
	const transport = new StdioServerTransport();
	await server.connect(transport);
}
