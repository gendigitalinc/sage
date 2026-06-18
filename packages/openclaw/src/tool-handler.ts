/**
 * before_tool_call handler: extracts artifacts from tool calls,
 * evaluates them through guardToolCall, returns block/pass/requireApproval decisions.
 *
 * NOTE: OpenClaw has no PostToolUse phase — only before_tool_call. Medium-risk
 * PI warnings (detected during WebFetch pre-fetch) cannot be surfaced here
 * because the warning must arrive after the tool executes. This is a platform
 * limitation; Claude Code and Cursor connectors handle this via PostToolUse.
 */

import {
	type ApprovalStore,
	type Artifact,
	addException,
	type Branding,
	type CanonicalToolType,
	canonicalizeToolName,
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

const OPENCLAW_TOOL_MAP: Record<string, CanonicalToolType> = {
	bash: "Bash",
	exec: "Bash",
	web_fetch: "WebFetch",
	write: "Write",
	edit: "Edit",
	read: "Read",
	apply_patch: "ApplyPatch",
};

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

function normalizeToolInput(
	toolName: string,
	params: Record<string, unknown>,
): Record<string, unknown> {
	switch (toolName) {
		case "write":
			return {
				...params,
				file_path: (params.path ?? "") as string,
				content: (params.content ?? "") as string,
			};
		case "edit":
			return {
				...params,
				file_path: (params.path ?? "") as string,
			};
		default:
			return params;
	}
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
	trustedDomainsDir: string,
	branding: Branding = defaultBranding,
): (event: ToolCallEvent, ctx?: ToolCallContext) => Promise<ToolCallResult | undefined> {
	async function handleToolCall(
		event: ToolCallEvent,
		ctx?: ToolCallContext,
	): Promise<ToolCallResult | undefined> {
		const sessionId = ctx?.sessionKey ?? "unknown";
		const completeHook = (result: string, data: Record<string, unknown> = {}): void => {
			logger.debug("OpenClaw tool hook completed", {
				agentRuntime: "openclaw",
				hookType: "PreToolUse",
				toolName: event.toolName,
				sessionId,
				result,
				...data,
			});
		};
		logger.debug("OpenClaw tool hook started", {
			agentRuntime: "openclaw",
			hookType: "PreToolUse",
			toolName: event.toolName,
			sessionId,
		});
		try {
			const { toolName, params } = event;

			// Map tool → artifacts. No artifacts → pass through.
			const artifacts = mapToolToArtifacts(toolName, params);
			if (!artifacts || artifacts.length === 0) {
				completeHook("skipped", { skippedReason: "no_artifacts" });
				return undefined;
			}

			const canonicalToolName = canonicalizeToolName(OPENCLAW_TOOL_MAP, toolName);
			const { verdict, actionId } = await guardToolCall(
				{
					sessionId,
					conversationId: sessionId,
					agentRuntime: "openclaw",
					toolName: canonicalToolName,
					toolInput: normalizeToolInput(toolName, params),
					artifacts,
				},
				{ threatsDir, trustedDomainsDir, logger },
				approvalStore,
			);

			if (verdict.decision === "allow") {
				completeHook("evaluated", {
					toolName: canonicalToolName,
					decision: verdict.decision,
					category: verdict.category,
					severity: verdict.severity,
					artifactsCount: artifacts.length,
				});
				return undefined;
			}

			if (verdict.decision === "deny") {
				completeHook("evaluated", {
					toolName: canonicalToolName,
					decision: verdict.decision,
					category: verdict.category,
					severity: verdict.severity,
					artifactsCount: artifacts.length,
				});
				return { block: true, blockReason: formatDenyMessage(verdict, branding) };
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
			const intersected = artifacts.filter((a) => verdict.artifacts.includes(a.value));
			const flaggedArtifacts = intersected.length > 0 ? intersected : artifacts;

			completeHook("evaluated", {
				toolName: canonicalToolName,
				decision: verdict.decision,
				category: verdict.category,
				severity: verdict.severity,
				artifactsCount: artifacts.length,
				actionId,
			});
			return {
				requireApproval: {
					id: actionId as string,
					title: `${branding.name}: ${verdict.category}`,
					description: [
						`Severity: ${verdict.severity}`,
						`Reason: ${reasons}`,
						`Artifacts: ${summarizeArtifacts(artifacts)}`,
					].join("\n"),
					severity: verdict.severity,
					timeoutBehavior: "deny",
					onResolution: async (decision: string) => {
						approvalStore.deletePending(actionId as string);
						if (decision !== "allow-always") {
							logger.debug("OpenClaw approval resolved without persistent allow", {
								actionId,
								decision,
							});
							return;
						}
						logger.info("OpenClaw approval accepted permanently", { actionId });
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
			completeHook("failed_open", { decision: "allow" });
			return undefined;
		}
	}

	return handleToolCall;
}
