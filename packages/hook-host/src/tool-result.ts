/**
 * `tool_result` (PostToolUse) handling shared by the pi and OMP connectors.
 *
 * Returning `{ content }` replaces what the model sees. Appended: a note after
 * an approved action, the medium-risk prompt-injection warning the pre-check
 * recorded for a fetched URL, and warnings from core's scan of the output.
 * Fail-open — any error leaves the result untouched.
 */

import {
	type AgentRuntime,
	type Artifact,
	type Branding,
	type CanonicalToolType,
	evaluateToolOutput,
	findPiWarningInAuditLog,
	formatPiWarning,
	type Logger,
	loadConfig,
	type Verdict,
} from "@gendigital/sage-core";
import type {
	HookHandlerExtensions,
	ToolCallAdapter,
	ToolCallContext,
	ToolCallEvent,
	ToolResultEvent,
	ToolResultPatch,
} from "./handler.js";

interface PendingApproval {
	threatId: string;
	threatTitle: string;
	artifacts: Array<{ type: string; value: string }>;
	createdAt: number;
}

/**
 * Approvals whose tool_result never arrives (crash, cancel) would otherwise
 * stay for the process lifetime. Same horizon as the approval store's sweep.
 */
const PENDING_APPROVAL_TTL_MS = 60 * 60 * 1000;

const artifactLabel = (type: string): string =>
	type === "url" ? "URL" : type === "file_path" ? "file path" : type;

const reasonOf = (verdict: Verdict): string => verdict.reasons[0] ?? verdict.category;

/** Text of a tool result's text blocks. */
export function resultText(content: ReadonlyArray<{ type: string; text?: string }>): string {
	return content
		.filter((c) => c.type === "text" && typeof c.text === "string")
		.map((c) => c.text as string)
		.join("\n");
}

/**
 * Shape tool output the way core's `evaluateToolOutput` reads it
 * (`hookInput.tool_response.{content|stdout|result}`). Tools whose output is
 * not scanned return undefined.
 */
export function outputHookInput(
	toolName: CanonicalToolType,
	text: string,
): Record<string, unknown> | undefined {
	if (!text) return undefined;
	switch (toolName) {
		case "Read":
			return { tool_response: { content: text } };
		case "Bash":
			return { tool_response: { stdout: text } };
		case "WebFetch":
			return { tool_response: { result: text } };
		default:
			return undefined;
	}
}

export interface OutputScanOptions {
	logger: Logger;
	branding: Branding;
	agentRuntime: AgentRuntime;
	agentRuntimeVersion?: string;
	/**
	 * Same adapter `tool_call` uses. A static raw-name map is not enough: OMP
	 * `read` is `Read` for a local path and `WebFetch` for a URL path, and the
	 * medium-risk PI warning is recorded only for the latter.
	 */
	adapter: ToolCallAdapter;
	threatsDir: string;
	trustedDomainsDir: string;
}

/** Builds the `onApproved` / `onToolResult` hooks for `registerHookHandlers`. */
export function createOutputScanHandlers(
	options: OutputScanOptions,
): Required<Pick<HookHandlerExtensions, "onApproved" | "onToolResult">> {
	const { logger, branding, adapter } = options;
	const pendingApprovals = new Map<string, PendingApproval>();
	// Tool call ids are only unique within a session, so scope the key by
	// session id: a reused id must not inherit another session's approval note.
	const pendingKey = (ctx: ToolCallContext, toolCallId: string): string =>
		`${ctx.sessionManager?.getSessionId() ?? "unknown"}:${toolCallId}`;
	const evaluationContext = {
		threatsDir: options.threatsDir,
		trustedDomainsDir: options.trustedDomainsDir,
		logger,
	};

	function prune(now = Date.now()): void {
		for (const [id, entry] of pendingApprovals) {
			if (now - entry.createdAt >= PENDING_APPROVAL_TTL_MS) pendingApprovals.delete(id);
		}
	}

	function onApproved(
		event: ToolCallEvent,
		verdict: Verdict,
		artifacts: Artifact[],
		ctx: ToolCallContext,
	): void {
		// Only allowlistable artifacts are tracked (free-form content is not
		// meaningful to allow).
		const matched = artifacts
			.filter((a) => a.type !== "content" && verdict.artifacts.includes(a.value))
			.map((a) => ({ type: a.type, value: a.value }));
		if (matched.length === 0) return;
		prune();
		pendingApprovals.set(pendingKey(ctx, event.toolCallId), {
			threatId: verdict.matchedThreatId ?? "unknown",
			threatTitle: reasonOf(verdict),
			artifacts: matched,
			createdAt: Date.now(),
		});
	}

	async function onToolResult(
		event: ToolResultEvent,
		ctx: ToolCallContext,
	): Promise<ToolResultPatch | undefined> {
		const parts: string[] = [];
		try {
			prune();
			const key = pendingKey(ctx, event.toolCallId);
			const pending = pendingApprovals.get(key);
			if (pending) {
				pendingApprovals.delete(key);
				const list = pending.artifacts
					.map((a) => `${artifactLabel(a.type)} '${a.value}'`)
					.join(", ");
				parts.push(
					`${branding.name}: The user approved a flagged action (threat ${pending.threatId}: ${pending.threatTitle}, artifacts: ${list}). To permanently allow this in the future, the user can add an exception rule to ~/.sage/exceptions.json.`,
				);
			}

			// Same mapping as tool_call, so a URL-shaped OMP `read` stays WebFetch
			// and picks up the medium-risk PI warning the pre-check recorded.
			// Unmapped tools emit no artifacts; skip them rather than scanning
			// under a guessed label.
			const mapped = adapter.mapToolCall(event.toolName, event.input, ctx.cwd);
			const toolName = mapped.artifacts.length > 0 ? mapped.toolName : undefined;
			if (toolName) {
				const config = await loadConfig(undefined, logger);

				// Medium-risk PI warning recorded by the pre-check on fetched content.
				// Known gap: findPiWarningInAuditLog matches on tool call id only,
				// and ids are unique per session, not globally. A reused id can
				// attach another session's warning. Needs a session-id filter in
				// core; left for that follow-up rather than changing the audit
				// lookup for every connector in this PR. The approval note above
				// is already session-scoped via pendingKey.
				if (toolName === "WebFetch" && config.logging.enabled && config.sensitivity !== "relaxed") {
					const warning = await findPiWarningInAuditLog(config.logging, event.toolCallId);
					if (warning) parts.push(`🛡️ ${formatPiWarning(warning, branding)}`);
				}

				// Heuristic prompt-injection scan of tool output.
				const hookInput = outputHookInput(toolName, resultText(event.content));
				if (hookInput) {
					const sessionId = ctx.sessionManager?.getSessionId() ?? "unknown";
					const warnings = await evaluateToolOutput(
						{
							sessionId,
							conversationId: sessionId,
							agentRuntime: options.agentRuntime,
							agentRuntimeVersion: options.agentRuntimeVersion,
							hookType: "PostToolUse",
							toolName,
							toolInput: event.input,
							hookInput,
							toolUseId: event.toolCallId,
						},
						evaluationContext,
					);
					for (const w of warnings) parts.push(`🛡️ ${w.message}`);
				}
			}
		} catch (error) {
			logger.error(`${branding.name} tool_result failed open`, {
				error: String(error),
				agentRuntime: options.agentRuntime,
			});
		}
		if (parts.length === 0) return undefined;
		return { content: [...event.content, { type: "text", text: parts.join("\n\n") }] };
	}

	return { onApproved, onToolResult };
}
