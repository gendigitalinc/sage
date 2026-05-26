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
	canonicalizeToolName,
	createOperationalLogger,
	evaluateToolOutput,
	findPiWarningInAuditLog,
	formatPiWarning,
	type Logger,
	loadConfig,
	nullLogger,
	resolveBranding,
} from "@gendigital/sage-core";
import { consumePendingApproval } from "./approval-tracker.js";
import { artifactTypeLabel } from "./format.js";

function getPluginRoot(): string {
	return resolve(__dirname, "..", "..", "..");
}

let logger: Logger = nullLogger;

async function main(): Promise<void> {
	const config = await loadConfig();
	logger = createOperationalLogger(config.operational_logging, "claude-code").forComponent(
		"post-tool-use",
	);
	const branding = resolveBranding(config.brand_key, logger);
	logger.debug("PostToolUse hook started", { hookType: "PostToolUse" });
	const completeHook = async (
		result: string,
		data: Record<string, unknown> = {},
	): Promise<void> => {
		logger.debug("PostToolUse hook completed", {
			hookType: "PostToolUse",
			result,
			...data,
		});
		await logger.flush?.();
	};

	let rawInput: string;
	try {
		rawInput = readFileSync(0, "utf-8");
	} catch {
		process.stdout.write("{}\n");
		await completeHook("skipped", { skippedReason: "no_input" });
		return;
	}

	let hookInput: Record<string, unknown>;
	try {
		hookInput = JSON.parse(rawInput) as Record<string, unknown>;
	} catch (error) {
		logger.warn("Failed to parse hook input", { error: String(error) });
		process.stdout.write("{}\n");
		await completeHook("failed_open", { skippedReason: "invalid_json" });
		return;
	}

	const toolUseId = (hookInput.tool_use_id ?? "") as string;
	const sessionId = (hookInput.session_id ?? "unknown") as string;
	const toolName = (hookInput.tool_name ?? "") as string;
	const canonicalToolName = canonicalizeToolName({}, toolName);
	const toolInput =
		hookInput.tool_input &&
		typeof hookInput.tool_input === "object" &&
		!Array.isArray(hookInput.tool_input)
			? (hookInput.tool_input as Record<string, unknown>)
			: {};
	if (!toolUseId) {
		process.stdout.write("{}\n");
		await completeHook("skipped", { skippedReason: "missing_tool_use_id", toolName, sessionId });
		return;
	}

	const contextParts: string[] = [];

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
		} catch (error) {
			logger.debug("Failed to resolve PI warning from audit log", { error: String(error) });
			// Best-effort
		}
	}

	// 3. Heuristic content scanning on tool output
	const pluginRoot = getPluginRoot();
	const warnings = await evaluateToolOutput(
		{
			sessionId,
			conversationId: sessionId,
			agentRuntime: "claude-code",
			hookType: "PostToolUse",
			toolName: canonicalToolName,
			toolInput,
			hookInput,
			toolUseId,
		},
		{
			threatsDir: join(pluginRoot, "threats"),
			allowlistsDir: join(pluginRoot, "allowlists"),
			logger,
		},
	);

	for (const w of warnings) {
		contextParts.push(`🛡️ ${w.message}`);
	}

	if (contextParts.length === 0) {
		process.stdout.write("{}\n");
		await completeHook("evaluated", {
			toolName,
			sessionId,
			toolUseId,
			warningsCount: warnings.length,
			contextInjected: false,
		});
		return;
	}

	const response = {
		hookSpecificOutput: {
			hookEventName: "PostToolUse",
			additionalContext: contextParts.join("\n\n"),
		},
	};

	process.stdout.write(`${JSON.stringify(response)}\n`);
	await completeHook("evaluated", {
		toolName,
		sessionId,
		toolUseId,
		warningsCount: warnings.length,
		contextInjected: true,
	});
	await BundledPiProvider.exitIfModelLoaded(logger);
}

main().catch(async (error) => {
	logger.error("PostToolUse hook failed open", { error: String(error) });
	process.stdout.write("{}\n");
	await logger.flush?.();
});
