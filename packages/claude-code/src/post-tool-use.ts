#!/usr/bin/env node
/**
 * Sage PostToolUse hook entry point.
 * 1. Detects user approvals of ask verdicts and records them.
 * 2. Scans tool output for prompt injection (heuristic rules + ML model).
 * Always exits 0 and returns valid JSON.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	BundledPiProvider,
	evaluateToolOutput,
	findPiWarningInAuditLog,
	formatPiWarning,
	type Logger,
	loadConfig,
	resolveBranding,
} from "@gendigital/sage-core";
import pino from "pino";
import { consumePendingApproval } from "./approval-tracker.js";
import { artifactTypeLabel } from "./format.js";

function getPluginRoot(): string {
	return resolve(__dirname, "..", "..", "..");
}

const logger: Logger = pino({ level: "warn" }, pino.destination(2));

async function main(): Promise<void> {
	let rawInput: string;
	try {
		rawInput = readFileSync(0, "utf-8");
	} catch {
		process.stdout.write("{}\n");
		return;
	}

	let hookInput: Record<string, unknown>;
	try {
		hookInput = JSON.parse(rawInput) as Record<string, unknown>;
	} catch {
		process.stdout.write("{}\n");
		return;
	}

	const toolUseId = (hookInput.tool_use_id ?? "") as string;
	const sessionId = (hookInput.session_id ?? "unknown") as string;
	const toolName = (hookInput.tool_name ?? "") as string;
	if (!toolUseId) {
		process.stdout.write("{}\n");
		return;
	}

	const contextParts: string[] = [];
	const config = await loadConfig(undefined, logger);
	const branding = resolveBranding(config.brand_key, logger);

	// 1. Approval tracking (existing behavior)
	const entry = await consumePendingApproval(sessionId, toolUseId, logger);
	if (entry) {
		const artifactList = entry.artifacts
			.map((a) => `${artifactTypeLabel(a.type)} '${a.value}'`)
			.join(", ");

		contextParts.push(
			`${branding.name}: The user approved a flagged action (threat ${entry.threatId}: ${entry.threatTitle}, artifacts: ${artifactList}). To permanently allow this in the future, the user can add an exception rule to ~/.sage/exceptions.json.`,
		);
	}

	// 2. PI warning injection from PreToolUse audit log (medium-risk WebFetch)
	if (
		toolName === "WebFetch" &&
		toolUseId &&
		config.logging.enabled &&
		config.sensitivity !== "relaxed"
	) {
		try {
			const piWarning = await findPiWarningInAuditLog(config.logging, toolUseId, config.pi_check);
			if (piWarning) {
				contextParts.push(`🛡️ ${formatPiWarning(piWarning, branding)}`);
			}
		} catch {
			// Best-effort
		}
	}

	// 3. Heuristic content scanning on tool output
	const pluginRoot = getPluginRoot();
	const warnings = await evaluateToolOutput(toolName, hookInput, {
		threatsDir: join(pluginRoot, "threats"),
		allowlistsDir: join(pluginRoot, "allowlists"),
		logger,
		agentRuntime: "claude-code",
		sessionId,
	});

	for (const w of warnings) {
		contextParts.push(`🛡️ ${w.message}`);
	}

	if (contextParts.length === 0) {
		process.stdout.write("{}\n");
		return;
	}

	const response = {
		hookSpecificOutput: {
			hookEventName: "PostToolUse",
			additionalContext: contextParts.join("\n\n"),
		},
	};

	process.stdout.write(`${JSON.stringify(response)}\n`);
	BundledPiProvider.exitIfModelLoaded();
}

main().catch(() => {
	process.stdout.write("{}\n");
});
