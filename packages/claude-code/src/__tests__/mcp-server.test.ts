/**
 * MCP server integration tests.
 * Spawns the bundled MCP server and communicates via JSON-RPC over stdio.
 * SDK uses newline-delimited JSON for stdio transport.
 */

import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DIST_DIR = resolve(__dirname, "..", "..", "dist");
const MCP_SERVER = resolve(DIST_DIR, "mcp-server.cjs");

function createJsonRpcMessage(method: string, params: unknown, id?: number): string {
	const msg: Record<string, unknown> = { jsonrpc: "2.0", method, params };
	if (id !== undefined) msg.id = id;
	return JSON.stringify(msg);
}

function sendToMcp(
	messages: string[],
): Promise<{ stdout: string; stderr: string; code: number | null }> {
	return new Promise((done) => {
		const child = execFile("node", [MCP_SERVER], { timeout: 10_000 }, (error, stdout, stderr) => {
			done({ stdout, stderr, code: error?.code ? Number(error.code) : child.exitCode });
		});

		// SDK uses newline-delimited JSON
		for (const msg of messages) {
			child.stdin?.write(`${msg}\n`);
		}

		setTimeout(() => child.stdin?.end(), 500);
	});
}

function parseJsonRpcResponses(stdout: string): Array<Record<string, unknown>> {
	return stdout
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => {
			try {
				return JSON.parse(line) as Record<string, unknown>;
			} catch {
				return null;
			}
		})
		.filter((r): r is Record<string, unknown> => r !== null);
}

function initSequence(): string[] {
	return [
		createJsonRpcMessage(
			"initialize",
			{
				protocolVersion: "2024-11-05",
				capabilities: {},
				clientInfo: { name: "test", version: "1.0" },
			},
			1,
		),
		createJsonRpcMessage("notifications/initialized", {}),
	];
}

describe("MCP server integration", () => {
	it("responds to initialize and lists Sage tools", async () => {
		const messages = [...initSequence(), createJsonRpcMessage("tools/list", {}, 2)];

		const { stdout, code } = await sendToMcp(messages);
		expect(code).toBe(0);

		const responses = parseJsonRpcResponses(stdout);
		const toolsResponse = responses.find((r) => r.id === 2);
		expect(toolsResponse).toBeDefined();

		const result = toolsResponse?.result as { tools: Array<{ name: string }> };
		expect(result.tools).toHaveLength(2);

		const toolNames = result.tools.map((t) => t.name).sort();
		expect(toolNames).toEqual(["sage_list_audit_entries", "sage_report_false_positive"]);
	}, 15_000);
});
