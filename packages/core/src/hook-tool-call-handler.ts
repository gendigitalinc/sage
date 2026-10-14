/**
 * Hook tool call handler: creates and registers a tool_call handler
 * for agent extensibility platforms (pi, OpenClaw, etc).
 */

import type { Artifact, Branding, Logger } from "./types.js";
import type { CanonicalToolType } from "./tool-names.js";
import { defaultBranding, formatDenyMessage, ruleLabel, summarizeArtifacts } from "./index.js";
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
		confirm(options?: { message?: string }): Promise<boolean>;
		setStatus(message: string): Promise<void>;
	};
	sessionManager?: { getSessionId(): string };
}

export interface ToolCallResult {
	block?: boolean;
	reason?: string;
}

export function registerHookHandlers(
	host: HookHostAPI,
	options: HookHandlerOptions,
): void {
	const { adapter, logger, branding = defaultBranding, packageRoot } = options;
	const approvalStore = new ApprovalStore();
	const threatsDir = resolve(packageRoot, "resources", "threats");
	const trustedDomainsDir = resolve(packageRoot, "resources", "trusted-domains");

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

			// Guard the tool call
			const guardResult = await guardToolCall(
				{
					toolName: canonicalName,
					toolInput,
					artifacts,
					sessionId,
				},
				{ logger, threatsDir, trustedDomainsDir },
				approvalStore,
			);

			const { verdict, actionId } = guardResult;

			// Handle verdict
			if (verdict.decision === "allow") {
				return undefined;
			}

			if (verdict.decision === "deny") {
				const reason = formatDenyMessage(verdict, branding);
				return { block: true, reason };
			}

			// Ask decision
			const message = `Sage ${branding.name} requires approval:\n\n${summarizeArtifacts(artifacts)}\n\n${ruleLabel(verdict)}`;

			// Check for UI
			if (!ctx.hasUI) {
				return { block: true, reason: "User denied (no UI attached)" };
			}

			try {
				const approved = await ctx.ui?.confirm?.({ message });
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
