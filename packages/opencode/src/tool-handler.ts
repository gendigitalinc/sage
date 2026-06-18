import {
	type ApprovalStore,
	type Branding,
	type CanonicalToolType,
	canonicalizeToolName,
	defaultBranding,
	formatDenyMessage,
	guardToolCall,
	type Logger,
	summarizeArtifacts,
} from "@gendigital/sage-core";

const OPENCODE_TOOL_MAP: Record<string, CanonicalToolType> = {
	bash: "Bash",
	webfetch: "WebFetch",
	write: "Write",
	edit: "Edit",
	read: "Read",
	glob: "Glob",
	grep: "Grep",
	ls: "List",
	codesearch: "CodeSearch",
	websearch: "WebSearch",
	question: "Question",
	task: "Task",
	read_lines: "ReadLines",
};

import { SageVerdictBlockError, SageVerdictError } from "./error.js";
import { extractFromOpenCodeTool } from "./extractors.js";

function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function normalizeToolInput(
	toolName: string,
	args: Record<string, unknown>,
): Record<string, unknown> {
	switch (toolName) {
		case "write":
			return {
				...args,
				file_path: asString(args.filePath) ?? asString(args.file_path) ?? "",
				content: asString(args.content) ?? "",
			};
		case "edit":
			return {
				...args,
				file_path: asString(args.filePath) ?? asString(args.file_path) ?? "",
				new_string: asString(args.newString) ?? asString(args.new_string) ?? "",
			};
		default:
			return args;
	}
}

export interface ToolHandlerOptions {
	showToast?: (msg: string, variant: "info" | "success" | "warning" | "error") => void;
}

export function createToolHandlers(
	logger: Logger,
	approvalStore: ApprovalStore,
	threatsDir: string,
	trustedDomainsDir: string,
	options?: ToolHandlerOptions,
	branding: Branding = defaultBranding,
) {
	const beforeToolUse = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { args: Record<string, unknown> },
	): Promise<void> => {
		const completeHook = (result: string, data: Record<string, unknown> = {}): void => {
			logger.debug("OpenCode tool hook completed", {
				agentRuntime: "opencode",
				hookType: "PreToolUse",
				toolName: input.tool,
				sessionId: input.sessionID,
				toolUseId: input.callID,
				result,
				...data,
			});
		};
		logger.debug("OpenCode tool hook started", {
			agentRuntime: "opencode",
			hookType: "PreToolUse",
			toolName: input.tool,
			sessionId: input.sessionID,
			toolUseId: input.callID,
		});

		try {
			const args = output.args ?? {};
			const artifacts = extractFromOpenCodeTool(input.tool, args);

			if (!artifacts || artifacts.length === 0) {
				completeHook("skipped", { skippedReason: "no_artifacts" });
				return;
			}

			const toolName = canonicalizeToolName(OPENCODE_TOOL_MAP, input.tool);
			const { verdict, actionId } = await guardToolCall(
				{
					sessionId: input.sessionID,
					conversationId: input.sessionID,
					agentRuntime: "opencode",
					toolName,
					toolInput: normalizeToolInput(input.tool, args),
					artifacts,
				},
				{
					threatsDir,
					trustedDomainsDir,
					logger,
				},
				approvalStore,
			);

			if (verdict.decision === "allow") {
				completeHook("evaluated", {
					toolName,
					decision: verdict.decision,
					category: verdict.category,
					severity: verdict.severity,
					artifactsCount: artifacts.length,
				});
				return;
			}

			try {
				const toastMsg =
					verdict.decision === "deny"
						? `${branding.name} blocked: ${verdict.reasons[0] ?? "Threat detected"} (${verdict.category})`
						: `${branding.name} flagged: ${verdict.reasons[0] ?? "Action flagged"} (${verdict.category})`;
				options?.showToast?.(toastMsg, verdict.severity === "critical" ? "error" : "warning");
			} catch {
				// Toast failure is non-critical — never prevent enforcement
			}

			if (verdict.decision === "deny") {
				completeHook("evaluated", {
					toolName,
					decision: verdict.decision,
					category: verdict.category,
					severity: verdict.severity,
					artifactsCount: artifacts.length,
				});
				throw new SageVerdictBlockError(formatDenyMessage(verdict, branding));
			}

			// ask — actionId is always set for ask verdicts
			const maxReasons = 3;
			const reasons =
				verdict.reasons.length > 0
					? verdict.reasons.slice(0, maxReasons).join("; ") +
						(verdict.reasons.length > maxReasons
							? `; ... and ${verdict.reasons.length - maxReasons} more`
							: "")
					: verdict.category;
			completeHook("evaluated", {
				toolName,
				decision: verdict.decision,
				reasons: verdict.reasons,
				category: verdict.category,
				severity: verdict.severity,
				artifactsCount: artifacts.length,
				actionId,
			});
			throw new SageVerdictBlockError(
				[
					`${branding.name} flagged this action (${verdict.category}): ${reasons}`,
					`Artifacts: ${summarizeArtifacts(artifacts)}`,
					`Call sage_approve({ actionId: "${actionId}" }) to request approval from the user.`,
					`After approval, retry the EXACT same tool call with identical arguments.`,
				].join("\n"),
			);
		} catch (error) {
			// Verdict errors are expected (blocks and asks); others are logged as fail-open
			if (error instanceof SageVerdictError) throw error;
			logger.error(`${branding.name} opencode hook failed open`, {
				error: String(error),
				tool: input.tool,
			});
			completeHook("failed_open", { decision: "allow" });
		}
	};

	return {
		"tool.execute.before": beforeToolUse,
	};
}
