/**
 * OpenCode v2 (opencode2 / `@opencode-ai/core`) adapter.
 *
 * v2 loads the package's default export as `{ id, setup }` and calls
 * `setup(context)` with domain APIs instead of v1's hooks object. This adapter
 * maps those domains onto the shared Sage controller:
 * - `tool.hook("execute.before")` → Sage tool interception. Throwing from the
 *   hook fails just that tool call with the thrown message (the turn continues),
 *   which is the v1 block semantics, so the same `SageVerdictBlockError` works.
 * - `tool.transform` → registers `sage_approve`, which requests a native
 *   permission prompt through `permission.assert`.
 * - `permission.hook("evaluate")` → forces Sage approval requests to ask.
 * - `mcp.transform` → registers the Sage MCP server unless `sage` exists.
 * - `session.hook("prompt")` → per-session plugin/skill scan.
 *
 * The v2 API types live in `v2-types.ts` (see there for the SDK version they
 * mirror); every payload is validated before use (fail open).
 */

import {
	ApprovalUnavailableError,
	approvalPatterns,
	createSageController,
	SAGE_MCP_SERVER_NAME,
	type SageController,
	sageMcpServerConfig,
	type ToastFn,
} from "./shared.js";
import type { V2PluginContext, V2Registration, V2ToolInfo } from "./v2-types.js";

export type {
	V2McpEditor,
	V2PluginContext,
	V2ToolContext,
	V2ToolEditor,
	V2ToolExecuteBefore,
	V2ToolInfo,
	V2ToolResult,
} from "./v2-types.js";

export const SAGE_APPROVE_TOOL = "sage_approve";
const SAGE_APPROVAL_ACTION = "sage_approval";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createApproveTool(sage: SageController, plugin: V2PluginContext): V2ToolInfo {
	return {
		name: SAGE_APPROVE_TOOL,
		description: sage.approveToolDescription,
		input: {
			type: "object",
			properties: {
				actionId: { type: "string", description: sage.approveArgDescription },
			},
			required: ["actionId"],
			additionalProperties: false,
		},
		// The approval dialog must be driven by the model directly, not from a
		// code-mode script.
		options: { codemode: false },
		async execute(input, context) {
			const actionId = isRecord(input) && typeof input.actionId === "string" ? input.actionId : "";
			const result = await sage.resolveApproval(actionId, async (pending) => {
				if (!plugin.permission || typeof plugin.permission.assert !== "function") {
					throw new ApprovalUnavailableError("OpenCode v2 permission API is unavailable");
				}
				await plugin.permission.assert({
					sessionID: context.sessionID,
					agent: context.agent,
					source: { type: "tool", messageID: context.messageID, id: context.id },
					action: SAGE_APPROVAL_ACTION,
					resources: [`${actionId}: ${approvalPatterns(pending).join(", ")}`],
					save: [],
				});
			});
			return { content: result };
		},
	};
}

/** OpenCode v2 plugin `setup`. Returns a cleanup that disposes registrations. */
export async function setupV2(context: V2PluginContext): Promise<() => Promise<void>> {
	const toast = context.toast;
	const createNotifier =
		toast && typeof toast.show === "function"
			? (branding: { name: string }): ToastFn =>
					(message, variant, duration) => {
						try {
							toast.show({ title: branding.name, message, variant, duration });
						} catch {
							// Notifications are best-effort
						}
					}
			: undefined;
	const sage = await createSageController({
		directory: context.location?.directory ?? process.cwd(),
		createNotifier,
		host: "v2",
	});
	const registrations: V2Registration[] = [];
	if (!context.permission || typeof context.permission.hook !== "function") {
		throw new Error("OpenCode v2 permission hook is required for Sage approvals");
	}
	registrations.push(
		await context.permission.hook("evaluate", (event) => {
			if (event.action === SAGE_APPROVAL_ACTION && event.effect === "allow") event.effect = "ask";
		}),
	);

	registrations.push(
		await context.tool.hook("execute.before", async (event) => {
			// Unexpected shapes fail open: Sage never blocks a call it can't read.
			if (!isRecord(event) || typeof event.tool !== "string") return;
			let args: Record<string, unknown> | undefined;
			let unrecognizedReason = "not_an_object";
			if (isRecord(event.input)) {
				args = event.input;
			} else if (typeof event.input === "string") {
				try {
					const parsed: unknown = JSON.parse(event.input);
					if (isRecord(parsed)) args = parsed;
					else unrecognizedReason = "json_not_an_object";
				} catch {
					unrecognizedReason = "invalid_json";
				}
			}
			if (!args) {
				sage.logger.warn("OpenCode v2 tool input has unrecognized shape", {
					tool: event.tool,
					sessionID: event.sessionID,
					callID: event.id,
					inputType: Array.isArray(event.input)
						? "array"
						: event.input === null
							? "null"
							: typeof event.input,
					reason: unrecognizedReason,
				});
			}
			await sage.beforeToolUse(
				{
					tool: event.tool,
					sessionID: typeof event.sessionID === "string" ? event.sessionID : "unknown",
					callID: typeof event.id === "string" ? event.id : "",
				},
				{ args: args ?? {} },
			);
		}),
	);

	registrations.push(
		await context.tool.transform((editor) => {
			if (!editor.get(SAGE_APPROVE_TOOL)) {
				editor.add(createApproveTool(sage, context));
			}
		}),
	);

	if (context.mcp) {
		registrations.push(
			await context.mcp.transform((editor) => {
				// Never clobber a user-supplied `sage` server.
				if (editor.get(SAGE_MCP_SERVER_NAME) !== undefined) return;
				editor.set(SAGE_MCP_SERVER_NAME, sageMcpServerConfig());
			}),
		);
	}

	if (context.session) {
		registrations.push(
			await context.session.hook("prompt", (event) => {
				const sessionID =
					isRecord(event) && typeof event.sessionID === "string" ? event.sessionID : "";
				// Don't hold up the prompt on the scan.
				void sage.scanSession(sessionID).catch((error) => {
					sage.logger.debug("Session scan failed", { error: String(error) });
				});
			}),
		);
	}

	return async () => {
		await Promise.allSettled(registrations.map((r) => r.dispose()));
	};
}
