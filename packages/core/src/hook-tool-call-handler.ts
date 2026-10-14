/**
 * Hook tool call handler: creates and registers a tool_call handler
 * for agent extensibility platforms (pi, OpenClaw, etc).
 */

import type { Artifact, Branding, Logger, Verdict } from "./types.js";
import type { CanonicalToolType } from "./tool-names.js";
import { defaultBranding, kv, PAD, remediationHint, ruleLabel, SEPARATOR_WIDTH, separatorLine, severityEmoji, summarizeArtifacts } from "./index.js";
import { ApprovalStore } from "./approval-store.js";
import { guardToolCall } from "./guard.js";
import { resolve } from "node:path";

export interface HookToolMapping {
	toolName: CanonicalToolType;
	toolInput: Record<string, unknown>;
	artifacts: Artifact[];
}

export interface ToolCallAdapter {
	mapToolCall: (toolName: string, input: Record<string, unknown>) => HookToolMapping;
}

export interface HookHandlerOptions {
	agentRuntime: string;
	adapter: ToolCallAdapter;
	packageRoot: string;
	logger: Logger;
	branding?: Branding;
}

export interface HookHostAPI {
	on(event: string, handler: (event: ToolCallEvent, ctx: ToolCallContext) => Promise<ToolCallResult | undefined>): void;
	sessionManager?: { getSessionId(): string };
	ui?: {
		confirm(options: { message: string; title?: string }): Promise<boolean>;
		setStatus(message: string): Promise<void>;
		setFooter?(message: string): Promise<void>;
	};
}

export interface ToolCallEvent {
	toolName: string;
	toolCallId: string;
	input: Record<string, unknown>;
}

export interface ToolCallContext {
	hasUI: boolean;
	ui?: {
		confirm(message: string): Promise<boolean>;
		setStatus(message: string): Promise<void>;
		setFooter?(message: string): Promise<void>;
	};
	sessionManager?: { getSessionId(): string };
}

export interface ToolCallResult {
	block?: boolean;
	reason?: string;
}

/** Rich shield banner matching the Claude Code format. */
function formatShieldBanner(verdict: Verdict, branding: Branding, action: string): string {
	const isDeny = verdict.decision === "deny";
	const emoji = severityEmoji(verdict.severity);
	const reasonText = verdict.reasons.length > 0 ? verdict.reasons[0] : verdict.category;
	const header = isDeny
		? `🛡️ ${branding.name}: Threat Blocked`
		: `🛡️ ${branding.name}: Suspicious Activity Detected`;
	const lines: string[] = [header, separatorLine(SEPARATOR_WIDTH)];
	lines.push(`${emoji} ${"Threat".padEnd(PAD)}${reasonText}`);
	const rule = ruleLabel(verdict);
	if (rule) lines.push(kv("Rule", rule));
	lines.push(kv("Severity", verdict.severity.toUpperCase()));
	if (verdict.artifacts.length > 0) {
		lines.push(kv("Artifact", verdict.artifacts[0]!));
		for (const a of verdict.artifacts.slice(1)) {
			lines.push(kv("", a));
		}
	}
	if (verdict.source && verdict.source !== "none") {
		lines.push(kv("Source", verdict.source));
	}
	lines.push(kv("Action", action));
	if (isDeny) {
		lines.push("");
		lines.push(remediationHint(verdict));
	}
	return lines.join("\n");
}

export function registerHookHandlers(
	host: HookHostAPI,
	options: HookHandlerOptions,
): void {
	const { adapter, logger, branding = defaultBranding, packageRoot } = options;
	const approvalStore = new ApprovalStore();
	const threatsDir = resolve(packageRoot, "resources", "threats");
	const trustedDomainsDir = resolve(packageRoot, "resources", "trusted-domains");

	// Show the shield in the footer when the session starts.
	// setFooter persists in a dedicated area that pi's own status bar won't overwrite.
	host.on("session_start", async (_event: unknown, ctx: ToolCallContext): Promise<undefined> => {
		try { await ctx.ui?.setFooter?.(`🛡️ ${branding.name}: ✅`); } catch { /* fail open */ }
		return undefined;
	});

	host.on("tool_call", async (event: ToolCallEvent, ctx: ToolCallContext): Promise<ToolCallResult | undefined> => {
		try {
			const { toolName, input } = event;
			const sessionId = ctx.sessionManager?.getSessionId?.() ?? "unknown";

			// Map the tool call through the adapter
			const { toolName: canonicalName, toolInput, artifacts } = adapter.mapToolCall(toolName, input);

			// If no artifacts, pass through
			if (artifacts.length === 0) {
				return undefined;
			}

			// Guard the tool call.
			// Compute action ID from the RAW input so two calls with different
			// raw payloads that normalize to the same toolInput (e.g. edits
			// with different oldText but identical newText) get distinct
			// approval entries.
			const rawActionId = ApprovalStore.actionId(canonicalName, input, sessionId);
			const guardResult = await guardToolCall(
				{
					toolName: canonicalName,
					toolInput,
					artifacts,
					sessionId,
				},
				{ logger, threatsDir, trustedDomainsDir },
				approvalStore,
				rawActionId,
			);

			const { verdict, actionId } = guardResult;

			// Handle verdict — update both status and footer (footer persists in pi's TUI).
			if (verdict.decision === "allow") {
				try { await ctx.ui?.setFooter?.(`🛡️ ${branding.name}: ✅`); } catch { /* fail open */ }
				return undefined;
			}

			if (verdict.decision === "deny") {
				const reason = formatShieldBanner(verdict, branding, "Blocked");
				try { await ctx.ui?.setFooter?.(`🛡️ ${branding.name}: 🚨 Blocked`); } catch { /* fail open */ }
				return { block: true, reason };
			}

			// Ask decision
			const message = formatShieldBanner(verdict, branding, "Requires confirmation");

			try { await ctx.ui?.setFooter?.(`🛡️ ${branding.name}: ⚠️ Suspicious`); } catch { /* fail open */ }

			// Check for UI
			if (!ctx.hasUI) {
				return { block: true, reason: "User denied (no UI attached)" };
			}

			try {
				const approved = await ctx.ui?.confirm?.(message);
				if (!approved) {
					return { block: true, reason: "User denied" };
				}
				// Mark as approved for future identical calls
				if (actionId) {
					approvalStore.approve(actionId);
				}
				return undefined;
			} catch (e) {
				logger.error("Approval UI error", { error: e });
				return { block: true, reason: "Approval prompt failed" };
			}
		} catch (error) {
			logger.error("Hook handler error", { error });
			// Fail open on internal errors
			return undefined;
		}
	});
}
