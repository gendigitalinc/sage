#!/usr/bin/env node
/**
 * Sage PostToolUse hook entry point.
 * Detects user approvals of ask verdicts and records them.
 * Always exits 0 and returns valid JSON.
 */

import { readFileSync } from "node:fs";
import { type Logger, loadBranding } from "@gendigital/sage-core";
import pino from "pino";
import { consumePendingApproval } from "./approval-tracker.js";
import { artifactTypeLabel } from "./format.js";

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
	if (!toolUseId) {
		process.stdout.write("{}\n");
		return;
	}

	const entry = await consumePendingApproval(sessionId, toolUseId, logger);
	if (!entry) {
		process.stdout.write("{}\n");
		return;
	}

	const branding = await loadBranding(logger);
	const artifactList = entry.artifacts
		.map((a) => `${artifactTypeLabel(a.type)} '${a.value}'`)
		.join(", ");

	const response = {
		hookSpecificOutput: {
			hookEventName: "PostToolUse",
			additionalContext: `${branding.product_name}: The user approved a flagged action (threat ${entry.threatId}: ${entry.threatTitle}, artifacts: ${artifactList}). To permanently allow this in the future, the user can add an exception rule to ~/.sage/exceptions.json.`,
		},
	};

	process.stdout.write(`${JSON.stringify(response)}\n`);
}

main().catch(() => {
	process.stdout.write("{}\n");
});
