import { access } from "node:fs/promises";
import path from "node:path";

import * as vscode from "vscode";

export interface McpServerArgs {
	command: string;
	args: string[];
	env: Record<string, string>;
}

type CursorMcpApi = {
	registerServer?: (args: { name: string; server: McpServerArgs }) => void;
	unregisterServer?: (name: string) => void;
};

function getCursorMcpApi(): CursorMcpApi | undefined {
	const maybeMcp = (vscode as unknown as { cursor?: { mcp?: unknown } }).cursor?.mcp;
	if (!maybeMcp || typeof maybeMcp !== "object") return undefined;
	return maybeMcp as CursorMcpApi;
}

function resolveNodeCommand(): { command: string; env: Record<string, string> } {
	const command = process.env.VSCODE_NODE_EXEC_PATH?.trim() || process.execPath;
	return { command, env: { ELECTRON_RUN_AS_NODE: "1" } };
}

async function resolveMcpServerScriptPath(context: vscode.ExtensionContext): Promise<string> {
	const candidates = [
		context.asAbsolutePath(path.join("dist", "mcp-server.cjs")),
		context.asAbsolutePath(path.join("resources", "mcp-server.cjs")),
	];
	for (const candidate of candidates) {
		try {
			await access(candidate);
			return candidate;
		} catch {
			// try next
		}
	}
	throw new Error("Unable to locate MCP server bundle. Build the extension or reinstall the VSIX.");
}

async function getMcpServerArgs(context: vscode.ExtensionContext): Promise<McpServerArgs> {
	const scriptPath = await resolveMcpServerScriptPath(context);
	const { command, env } = resolveNodeCommand();
	return {
		command,
		args: [scriptPath],
		env,
	};
}

// Cursor has own API to register MCP server, it is automatically enabled
// This API does not work in VS Code
export async function installCursorMcpServer(context: vscode.ExtensionContext): Promise<void> {
	const cursorMcp = getCursorMcpApi();
	if (typeof cursorMcp?.registerServer !== "function") {
		throw new Error("Cursor MCP API is not available in this host.");
	}

	cursorMcp.registerServer({
		name: "sage",
		server: await getMcpServerArgs(context),
	});
}

export async function removeCursorMcpServer(): Promise<void> {
	const cursorMcp = getCursorMcpApi();
	if (typeof cursorMcp?.unregisterServer !== "function") return;
	cursorMcp.unregisterServer("sage");
}

// VS Code currently supports only provider registration, no API to enable/disable MCP server
// Advantage over cursor is that it gets cleaned during uninstall and UI shows its "Gen Sage" plugin origin
// Does not work in Cursor
export function registerVsCodeMcpServerProvider(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.lm.registerMcpServerDefinitionProvider("sage.mcp-servers", {
			provideMcpServerDefinitions: async () => {
				const server = await getMcpServerArgs(context);
				return [
					new vscode.McpStdioServerDefinition("sage", server.command, server.args, server.env),
				];
			},
		}),
	);
}
