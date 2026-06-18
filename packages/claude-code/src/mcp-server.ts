#!/usr/bin/env node

/**
 * Sage MCP server for Claude Code.
 * Provides Sage MCP tools, including:
 * - sage_report_false_positive / sage_list_audit_entries (audit log reporting)
 * - sage_claude_pre_tool_use / sage_claude_post_tool_use (long-lived hook path)
 */

import {
	BundledPiProvider,
	createOperationalLogger,
	type Logger,
	loadConfig,
	nullLogger,
	resolveBranding,
} from "@gendigital/sage-core";
import { createSageMcpServer } from "@gendigital/sage-mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getPluginRoot } from "./hook-handlers.js";
import { hideToolsFromListing, registerClaudeHookTools } from "./mcp-hook-tools.js";

let logger: Logger = nullLogger;
let shutdownFn: ((exitCode?: number) => Promise<void>) | null = null;

declare const __SAGE_VERSION__: string;

function registerProcessShutdown(): (exitCode?: number) => Promise<void> {
	if (shutdownFn) return shutdownFn;

	let shuttingDown = false;
	const shutdown = async (exitCode?: number): Promise<void> => {
		if (shuttingDown) return;
		shuttingDown = true;
		try {
			await BundledPiProvider.exitIfModelLoaded(logger);
		} catch (error) {
			logger.debug("PI runtime shutdown workaround failed open", { error: String(error) });
		}
		await logger.flush?.();
		if (exitCode !== undefined) process.exit(exitCode);
	};
	shutdownFn = shutdown;

	process.once("beforeExit", () => {
		void shutdown();
	});
	process.once("SIGINT", () => {
		void shutdown(130);
	});
	process.once("SIGTERM", () => {
		void shutdown(143);
	});
	return shutdown;
}

async function main(): Promise<void> {
	const config = await loadConfig();
	logger = createOperationalLogger(config.operational_logging, "claude-code").forComponent(
		"mcp-server",
	);
	const shutdown = registerProcessShutdown();
	const branding = resolveBranding(config.brand_key, logger);

	const server = createSageMcpServer({
		version: __SAGE_VERSION__,
		logger,
		branding,
	});
	registerClaudeHookTools(server, {
		logger,
		pluginRoot: getPluginRoot(),
		runtime: { config, branding },
	});
	hideToolsFromListing(server, undefined, logger);

	const transport = new StdioServerTransport();
	// Exit deterministically when the host disconnects. The PI ONNX runtime and
	// the shared AMSI PowerShell child keep the event loop alive, so without an
	// explicit exit the server lingers if the host only closes stdio instead of
	// killing the process. StdioServerTransport does not detect stdin EOF itself
	// (it only listens to 'data'/'error'), so the stdin listeners are the real
	// trigger; server.server.onclose covers explicit server/transport closes.
	const onDisconnect = () => {
		logger.debug("MCP transport closed; shutting down");
		void shutdown(0);
	};
	process.stdin.once("end", onDisconnect);
	process.stdin.once("close", onDisconnect);
	process.stdin.once("error", onDisconnect);
	server.server.onclose = onDisconnect;
	await server.connect(transport);
	logger.debug("MCP server connected", {
		serverName: branding.name.toLowerCase(),
		version: __SAGE_VERSION__,
	});
}

main().catch(async (e) => {
	logger.error("MCP server failed", { error: String(e) });
	await logger.flush?.();
	process.exit(1);
});
