import {
	type ApprovalStore,
	type Branding,
	type CanonicalToolType,
	canonicalizeToolName,
	defaultBranding,
	formatAskMessage,
	formatDenyMessage,
	guardToolCall,
	type Logger,
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
					toolName: canonicalizeToolName(OPENCODE_TOOL_MAP, input.tool),
					toolInput: normalizeToolInput(input.tool, args),
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
						? `${branding.name} blocked: ${verdict.reasons[0] ?? "Threat detected"} (${verdict.category})`
						: `${branding.name} flagged: ${verdict.reasons[0] ?? "Action flagged"} (${verdict.category})`;
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
			logger.error(`${branding.name} opencode hook failed open`, {
				error: String(error),
				tool: input.tool,
			});
		}
	};

	return {
		"tool.execute.before": beforeToolUse,
	};
}
