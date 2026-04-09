import {
	type ApprovalStore,
	type Branding,
	defaultBranding,
	formatAskMessage,
	formatDenyMessage,
	guardToolCall,
	type Logger,
} from "@gendigital/sage-core";
import { SageVerdictBlockError, SageVerdictError } from "./error.js";
import { extractFromOpenCodeTool } from "./extractors.js";

export interface ToolHandlerOptions {
	showToast?: (msg: string, variant: "info" | "success" | "warning" | "error") => void;
}

export function createToolHandlers(
	logger: Logger,
	approvalStore: ApprovalStore,
	threatsDir: string,
	allowlistsDir: string,
	options?: ToolHandlerOptions,
	branding: Branding = defaultBranding,
) {
	const beforeToolUse = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { args: Record<string, unknown> },
	): Promise<void> => {
		logger.debug(`tool.execute.before hook invoked (tool=${input.tool})`);

		try {
			const args = output.args ?? {};
			const artifacts = extractFromOpenCodeTool(input.tool, args);

			if (!artifacts || artifacts.length === 0) {
				return;
			}

			const { verdict, actionId } = await guardToolCall(
				{
					sessionId: input.sessionID,
					conversationId: input.sessionID,
					agentRuntime: "opencode",
					toolName: input.tool,
					toolInput: args,
					artifacts,
				},
				{
					threatsDir,
					allowlistsDir,
					logger,
				},
				approvalStore,
			);

			if (verdict.decision === "allow") {
				return;
			}

			try {
				const toastMsg =
					verdict.decision === "deny"
						? `${branding.product_name} blocked: ${verdict.reasons[0] ?? "Threat detected"} (${verdict.category})`
						: `${branding.product_name} flagged: ${verdict.reasons[0] ?? "Action flagged"} (${verdict.category})`;
				options?.showToast?.(toastMsg, verdict.severity === "critical" ? "error" : "warning");
			} catch {
				// Toast failure is non-critical — never prevent enforcement
			}

			if (verdict.decision === "deny") {
				throw new SageVerdictBlockError(formatDenyMessage(verdict, branding));
			}

			// ask — actionId is always set for ask verdicts
			throw new SageVerdictBlockError(
				formatAskMessage(actionId as string, verdict, artifacts, branding),
			);
		} catch (error) {
			// Verdict errors are expected (blocks and asks); others are logged as fail-open
			if (error instanceof SageVerdictError) throw error;
			logger.error(`${branding.product_name} opencode hook failed open`, {
				error: String(error),
				tool: input.tool,
			});
		}
	};

	return {
		"tool.execute.before": beforeToolUse,
	};
}
