/**
 * before_tool_call handler: extracts artifacts from tool calls,
 * evaluates them through guardToolCall, returns block/pass/requireApproval decisions.
 */

import {
	type ApprovalStore,
	type Artifact,
	addException,
	type Branding,
	defaultBranding,
	extractFromBash,
	extractFromEdit,
	extractFromWebFetch,
	extractFromWrite,
	formatDenyMessage,
	guardToolCall,
	type Logger,
	summarizeArtifacts,
} from "@gendigital/sage-core";

export interface ToolCallEvent {
	toolName: string;
	params: Record<string, unknown>;
}

export interface ToolCallContext {
	sessionKey?: string;
}

export interface BlockResult {
	block: true;
	blockReason: string;
}

export interface ApprovalRequest {
	id: string;
	title: string;
	description: string;
	severity?: "info" | "warning" | "critical";
	timeoutBehavior: "deny";
	onResolution?: (decision: string) => Promise<void> | void;
}

export type ToolCallResult = BlockResult | { requireApproval: ApprovalRequest };

function extractFilePaths(patch: string): Artifact[] {
	// OpenClaw apply_patch uses unified diff format; extract file paths from --- and +++ lines
	const artifacts: Artifact[] = [];
	for (const line of patch.split("\n")) {
		const match = line.match(/^(?:---|\+\+\+)\s+(?:a\/|b\/)?(.+)/);
		if (match?.[1] && match[1] !== "/dev/null") {
			artifacts.push({ type: "file_path", value: match[1], context: "apply_patch" });
		}
	}
	return artifacts;
}

function mapToolToArtifacts(toolName: string, params: Record<string, unknown>): Artifact[] | null {
	switch (toolName) {
		case "bash":
		case "exec": {
			const command = (params.command ?? "") as string;
			return command ? extractFromBash(command) : null;
		}
		case "web_fetch":
			return extractFromWebFetch({ url: params.url });
		case "write":
			return extractFromWrite({ file_path: params.path, content: params.content });
		case "edit":
			return extractFromEdit({ file_path: params.path, new_string: params.new_string });
		case "read": {
			const path = (params.path ?? "") as string;
			return path ? [{ type: "file_path", value: path, context: "read" }] : null;
		}
		case "apply_patch": {
			const patch = (params.patch ?? "") as string;
			return patch ? extractFilePaths(patch) : null;
		}
		default:
			return null;
	}
}

export function createToolCallHandler(
	approvalStore: ApprovalStore,
	logger: Logger,
	threatsDir: string,
	allowlistsDir: string,
	branding: Branding = defaultBranding,
): (event: ToolCallEvent, ctx?: ToolCallContext) => Promise<ToolCallResult | undefined> {
	async function handleToolCall(
		event: ToolCallEvent,
		ctx?: ToolCallContext,
	): Promise<ToolCallResult | undefined> {
		try {
			const { toolName, params } = event;

			// Map tool → artifacts. No artifacts → pass through.
			const artifacts = mapToolToArtifacts(toolName, params);
			if (!artifacts || artifacts.length === 0) return undefined;

			const sessionId = ctx?.sessionKey ?? "unknown";
			const { verdict, actionId } = await guardToolCall(
				{
					sessionId,
					conversationId: sessionId,
					agentRuntime: "openclaw",
					toolName,
					toolInput: params,
					artifacts,
				},
				{ threatsDir, allowlistsDir, logger },
				approvalStore,
			);

			if (verdict.decision === "allow") return undefined;

			if (verdict.decision === "deny") {
				return { block: true, blockReason: formatDenyMessage(verdict, branding) };
			}

			// ask — actionId is always set for ask verdicts
			const reasons =
				verdict.reasons.length > 0 ? verdict.reasons.slice(0, 3).join("; ") : verdict.category;
			const intersected = artifacts.filter((a) => verdict.artifacts.includes(a.value));
			const flaggedArtifacts = intersected.length > 0 ? intersected : artifacts;

			return {
				requireApproval: {
					id: actionId as string,
					title: `${branding.product_name}: ${verdict.category}`,
					description: [
						`Severity: ${verdict.severity}`,
						`Reason: ${reasons}`,
						`Artifacts: ${summarizeArtifacts(artifacts)}`,
					].join("\n"),
					severity: verdict.severity,
					timeoutBehavior: "deny",
					onResolution: async (decision: string) => {
						approvalStore.deletePending(actionId as string);
						if (decision !== "allow-always") return;
						for (const a of flaggedArtifacts) {
							await addException(
								{ type: a.type as "url" | "command" | "file_path", value: a.value },
								"Approved by user via native approval",
								undefined,
								logger,
							);
						}
					},
				},
			};
		} catch (e) {
			// Fail-open: any unhandled error → pass through
			logger.error("tool-handler error, failing open", { error: String(e) });
			return undefined;
		}
	}

	return handleToolCall;
}
