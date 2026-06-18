import { join, resolve } from "node:path";
import {
	type AmsiClientLease,
	type Artifact,
	type Branding,
	type Config,
	canonicalizeToolName,
	defaultBranding,
	evaluateToolCall,
	evaluateToolOutput,
	extractFromBash,
	extractFromEdit,
	extractFromRead,
	extractFromWebFetch,
	extractFromWrite,
	findPiWarningInAuditLog,
	formatPiWarning,
	type Logger,
	nullLogger,
	type Verdict,
} from "@gendigital/sage-core";
import { addPendingApproval, consumePendingApproval } from "./approval-tracker.js";
import { artifactTypeLabel, formatBlockReason } from "./format.js";

export type HookJsonResponse = Record<string, unknown>;

type CompleteHook = (result: string, data?: Record<string, unknown>) => Promise<void>;

export interface ClaudeHookHandlerOptions {
	config: Config;
	branding: Branding;
	logger?: Logger;
	pluginRoot?: string;
	agentRuntimeVersion?: string;
	completeHook?: CompleteHook;
	acquireAmsiClientLease?: (logger: Logger) => Promise<AmsiClientLease | null>;
}

export function getPluginRoot(): string {
	// When bundled by esbuild into CJS, __dirname points to packages/claude-code/dist/.
	// Plugin root is three levels up.
	return resolve(__dirname, "..", "..", "..");
}

export function makePreToolUseResponse(
	verdict: Verdict,
	branding: Branding = defaultBranding,
): HookJsonResponse {
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

	// For ask: full banner in permissionDecisionReason (shown once in dialog).
	return {
		hookSpecificOutput: {
			hookEventName: "PreToolUse",
			permissionDecision: verdict.decision,
			permissionDecisionReason: banner,
		},
	};
}

async function complete(
	completeHook: CompleteHook | undefined,
	result: string,
	data: Record<string, unknown> = {},
): Promise<void> {
	await completeHook?.(result, data);
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

export async function handlePreToolUseHook(
	toolCall: Record<string, unknown>,
	options: ClaudeHookHandlerOptions,
): Promise<HookJsonResponse> {
	const logger = options.logger ?? nullLogger;
	const completeHook = options.completeHook;
	const config = options.config;
	const branding = options.branding;
	const toolName = (toolCall.tool_name ?? "") as string;
	const toolInput = asRecord(toolCall.tool_input);
	const sessionId = (toolCall.session_id ?? "unknown") as string;
	const toolUseId = (toolCall.tool_use_id ?? "") as string;
	const pluginRoot = options.pluginRoot ?? getPluginRoot();

	let artifacts: Artifact[];
	switch (toolName) {
		case "Bash": {
			const command = (toolInput.command ?? "") as string;
			if (!command) {
				await complete(completeHook, "skipped", {
					skippedReason: "empty_command",
					toolName,
					sessionId,
					toolUseId,
				});
				return {};
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
			await complete(completeHook, "skipped", {
				skippedReason: "unsupported_tool",
				toolName,
				sessionId,
				toolUseId,
			});
			return {};
	}

	const verdict = await evaluateToolCall(
		{
			sessionId,
			conversationId: sessionId,
			agentRuntime: "claude-code",
			agentRuntimeVersion: options.agentRuntimeVersion,
			hookType: "PreToolUse",
			toolName,
			toolInput,
			artifacts,
			toolUseId,
		},
		{
			threatsDir: join(pluginRoot, "threats"),
			trustedDomainsDir: join(pluginRoot, "trusted-domains"),
			config,
			logger,
			acquireAmsiClientLease: options.acquireAmsiClientLease,
		},
	);

	// Only track approvals for allowlistable types (content varies per call, not meaningful to allowlist).
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
				// Best-effort — failure doesn't affect the verdict.
			}
		}
	}

	await complete(completeHook, "evaluated", {
		toolName,
		sessionId,
		toolUseId,
		decision: verdict.decision,
		category: verdict.category,
		severity: verdict.severity,
		artifactsCount: artifacts.length,
	});
	return makePreToolUseResponse(verdict, branding);
}

export async function handlePostToolUseHook(
	hookInput: Record<string, unknown>,
	options: ClaudeHookHandlerOptions,
): Promise<HookJsonResponse> {
	const logger = options.logger ?? nullLogger;
	const completeHook = options.completeHook;
	const config = options.config;
	const branding = options.branding;
	const toolUseId = (hookInput.tool_use_id ?? "") as string;
	const sessionId = (hookInput.session_id ?? "unknown") as string;
	const toolName = (hookInput.tool_name ?? "") as string;
	const canonicalToolName = canonicalizeToolName({}, toolName);
	const toolInput = asRecord(hookInput.tool_input);

	if (!toolUseId) {
		await complete(completeHook, "skipped", {
			skippedReason: "missing_tool_use_id",
			toolName,
			sessionId,
		});
		return {};
	}

	const contextParts: string[] = [];

	// 1. Approval tracking.
	const entry = await consumePendingApproval(sessionId, toolUseId, logger);
	if (entry) {
		const artifactList = entry.artifacts
			.map((a) => `${artifactTypeLabel(a.type)} '${a.value}'`)
			.join(", ");

		contextParts.push(
			`${branding.name}: The user approved a flagged action (threat ${entry.threatId}: ${entry.threatTitle}, artifacts: ${artifactList}). To permanently allow this in the future, the user can add an exception rule to ~/.sage/exceptions.json.`,
		);
	}

	// 2. PI warning injection from PreToolUse audit log (medium-risk WebFetch).
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
			// Best-effort.
		}
	}

	// 3. Heuristic content scanning on tool output.
	const pluginRoot = options.pluginRoot ?? getPluginRoot();
	const warnings = await evaluateToolOutput(
		{
			sessionId,
			conversationId: sessionId,
			agentRuntime: "claude-code",
			agentRuntimeVersion: options.agentRuntimeVersion,
			hookType: "PostToolUse",
			toolName: canonicalToolName,
			toolInput,
			hookInput,
			toolUseId,
		},
		{
			threatsDir: join(pluginRoot, "threats"),
			trustedDomainsDir: join(pluginRoot, "trusted-domains"),
			config,
			logger,
		},
	);

	for (const w of warnings) {
		contextParts.push(`🛡️ ${w.message}`);
	}

	if (contextParts.length === 0) {
		await complete(completeHook, "evaluated", {
			toolName,
			sessionId,
			toolUseId,
			warningsCount: warnings.length,
			contextInjected: false,
		});
		return {};
	}

	await complete(completeHook, "evaluated", {
		toolName,
		sessionId,
		toolUseId,
		warningsCount: warnings.length,
		contextInjected: true,
	});
	return {
		hookSpecificOutput: {
			hookEventName: "PostToolUse",
			additionalContext: contextParts.join("\n\n"),
		},
	};
}
