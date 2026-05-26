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

function resolveNodeCommand(runtime: "cursor" | "vscode"): {
	command: string;
	env: Record<string, string>;
} {
	const command = process.env.VSCODE_NODE_EXEC_PATH?.trim() || process.execPath;
	// SAGE_APP_ROOT is consumed by the MCP server child process to resolve the
	// agent runtime version at runtime (via `readProductJsonVersion`), avoiding
	// a stale value baked at install time. The MCP server is launched directly
	// by the IDE — not through the hook shim — so it receives `SAGE_APP_ROOT`
	// here rather than via `createHookShim`.
	const env: Record<string, string> = {
		ELECTRON_RUN_AS_NODE: "1",
		SAGE_AGENT_RUNTIME: runtime,
	};
	if (vscode.env.appRoot) {
		env.SAGE_APP_ROOT = vscode.env.appRoot;
	}
	return { command, env };
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

async function getMcpServerArgs(
	context: vscode.ExtensionContext,
	runtime: "cursor" | "vscode",
): Promise<McpServerArgs> {
	const scriptPath = await resolveMcpServerScriptPath(context);
	const { command, env } = resolveNodeCommand(runtime);
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
		server: await getMcpServerArgs(context, "cursor"),
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
				const server = await getMcpServerArgs(context, "vscode");
				return [
					new vscode.McpStdioServerDefinition("sage", server.command, server.args, server.env),
				];
			},
		}),
	);
}
