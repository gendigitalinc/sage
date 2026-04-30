#!/usr/bin/env node
/**
 * Sage PreToolUse hook entry point.
 * Reads tool call JSON from stdin, checks for threats, outputs verdict JSON to stdout.
 * Always exits 0 — even on errors, outputs an allow verdict.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	type Artifact,
	allowVerdict,
	type Branding,
	BundledPiProvider,
	defaultBranding,
	evaluateToolCall,
	extractFromBash,
	extractFromEdit,
	extractFromRead,
	extractFromWebFetch,
	extractFromWrite,
	type Logger,
	loadConfig,
	resolveBranding,
	type Verdict,
} from "@gendigital/sage-core";
import pino from "pino";
import { addPendingApproval } from "./approval-tracker.js";
import { formatBlockReason } from "./format.js";

const logger: Logger = pino({ level: "warn" }, pino.destination(2));

function makeResponse(verdict: Verdict, branding: Branding): Record<string, unknown> {
	if (verdict.decision === "allow") return {};

	const banner = formatBlockReason(verdict, branding);

	if (verdict.decision === "deny") {
		return {
			systemMessage: banner,
			hookSpecificOutput: {
				hookEventName: "PreToolUse",
				permissionDecision: "deny",
				permissionDecisionReason: `Blocked by ${branding.name}`,
			},
		};
	}

	// For ask: full banner in permissionDecisionReason (shown once in dialog)
	return {
		hookSpecificOutput: {
			hookEventName: "PreToolUse",
			permissionDecision: verdict.decision,
			permissionDecisionReason: banner,
		},
	};
}

function getPluginRoot(): string {
	// When bundled by esbuild into CJS, __dirname points to packages/claude-code/dist/
	// Plugin root is three levels up.
	return resolve(__dirname, "..", "..", "..");
}

async function main(): Promise<void> {
	const config = await loadConfig(undefined, logger);
	const branding = resolveBranding(config.brand_key, logger);

	let rawInput: string;
	try {
		rawInput = readFileSync(0, "utf-8");
	} catch {
		process.stdout.write("{}\n");
		return;
	}

	let toolCall: Record<string, unknown>;
	try {
		toolCall = JSON.parse(rawInput) as Record<string, unknown>;
	} catch (e) {
		process.stdout.write(
			`${JSON.stringify(makeResponse(allowVerdict(`Failed to parse input: ${e}`), branding))}\n`,
		);
		return;
	}

	const toolName = (toolCall.tool_name ?? "") as string;
	const toolInput = (toolCall.tool_input ?? {}) as Record<string, unknown>;
	const sessionId = (toolCall.session_id ?? "unknown") as string;
	const toolUseId = (toolCall.tool_use_id ?? "") as string;
	const pluginRoot = getPluginRoot();

	// Extract artifacts based on tool type
	let artifacts: Artifact[];
	switch (toolName) {
		case "Bash": {
			const command = (toolInput.command ?? "") as string;
			if (!command) {
				process.stdout.write("{}\n");
				return;
			}
			artifacts = extractFromBash(command);
			break;
		}
		case "WebFetch":
			artifacts = extractFromWebFetch(toolInput);
			break;
		case "Write":
			artifacts = extractFromWrite(toolInput);
			break;
		case "Edit":
			artifacts = extractFromEdit(toolInput);
			break;
		case "Read":
			artifacts = extractFromRead(toolInput);
			break;
		// No Delete case — Claude Code does not expose a Delete tool.
		// Delete is handled only in VS Code and Cursor connectors.
		default:
			process.stdout.write("{}\n");
			return;
	}

	const verdict = await evaluateToolCall(
		{
			sessionId,
			conversationId: sessionId,
			agentRuntime: "claude-code",
			hookType: "PreToolUse",
			toolName,
			toolInput,
			artifacts,
			toolUseId,
		},
		{
			threatsDir: join(pluginRoot, "threats"),
			allowlistsDir: join(pluginRoot, "allowlists"),
			logger,
		},
	);

	// Only track approvals for allowlistable types (content varies per call, not meaningful to allowlist)
	if (verdict.decision === "ask" && toolUseId) {
		const matched = artifacts
			.filter((a) => a.type !== "content" && verdict.artifacts.includes(a.value))
			.map((a) => ({ value: a.value, type: a.type }));
		if (matched.length > 0) {
			try {
				await addPendingApproval(
					sessionId,
					toolUseId,
					{
						threatId: verdict.matchedThreatId ?? "unknown",
						threatTitle: verdict.reasons[0] ?? verdict.category,
						artifacts: matched,
					},
					logger,
				);
			} catch {
				// Best-effort — failure doesn't affect the verdict
			}
		}
	}

	process.stdout.write(`${JSON.stringify(makeResponse(verdict, branding))}\n`);
	BundledPiProvider.exitIfModelLoaded();
}

main().catch((e) => {
	process.stdout.write(
		`${JSON.stringify(makeResponse(allowVerdict(`Internal error: ${e}`), defaultBranding))}\n`,
	);
});
