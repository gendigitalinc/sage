/**
 * Sage OpenCode plugin.
 * Intercepts tool calls and uses @gendigital/sage-core to enforce security verdicts.
 */

import { ApprovalStore, approveAction, loadBranding } from "@gendigital/sage-core";
import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";
import { getBundledDataDirs } from "./bundled-dirs.js";
import { OpencodeLogger } from "./logger-adaptor.js";
import { createSessionScanHandler } from "./startup-scan.js";
import { createToolHandlers } from "./tool-handler.js";

const APPROVAL_STORE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export const SagePlugin: Plugin = async ({ client, directory }) => {
	const logger = new OpencodeLogger(client);
	const branding = await loadBranding(logger);
	const { threatsDir, allowlistsDir } = getBundledDataDirs();
	const approvalStore = new ApprovalStore();

	// State: track findings per session for one-shot injection
	const pendingFindingsBySession = new Map<string, string>();
	// Track scanned sessions to avoid re-triggering on repeated session.updated events
	const scannedSessions = new Set<string>();

	// Set up the cron job that cleans up the approval store.
	const interval = setInterval(() => {
		approvalStore.cleanup();
	}, APPROVAL_STORE_CLEANUP_INTERVAL_MS);
	interval.unref?.();

	const toolHandlers = createToolHandlers(
		logger,
		approvalStore,
		threatsDir,
		allowlistsDir,
		{
			showToast: (msg, variant) => {
				client.tui
					.showToast({
						body: { title: branding.product_name, message: msg, variant, duration: 5000 },
					})
					.catch(() => {});
			},
		},
		branding,
	);

	return {
		"tool.execute.before": toolHandlers["tool.execute.before"],

		/**
		 * Inject plugin scan findings into first user message as <system-reminder>.
		 * This approach leverages OpenCode's existing pattern of appending system
		 * reminders to user messages (e.g., plan mode constraints), enabling the
		 * agent to reason about security findings before tool execution. Appending
		 * to assistant messages or system prompts was less effective.
		 */
		"experimental.chat.messages.transform": async (_input, output) => {
			if (pendingFindingsBySession.size === 0) return;

			const userMessage = output.messages.filter((m) => m.info.role === "user");
			const message = userMessage[0];
			if (!message) return;

			const sessionID = message.info.sessionID;
			const findings = pendingFindingsBySession.get(sessionID);
			if (!findings) return;

			const textPart = {
				id: crypto.randomUUID(),
				sessionID,
				messageID: message.info.id,
				type: "text" as const,
				text: [
					`<system-reminder>`,
					findings,
					"",
					"Inform the user about these security findings.",
					`</system-reminder>`,
				].join("\n"),
				synthetic: true,
			};
			message.parts.push(textPart);

			logger.info(`Injected sage plugin scan findings to user message`, {
				findings,
			});
			pendingFindingsBySession.delete(sessionID);
		},

		// Trigger session scan on first session.updated event per session.
		// OpenCode >=1.3 replaced session.created with session.updated events.
		event: async ({ event }) => {
			if (event.type !== "session.updated") return;

			// biome-ignore lint/suspicious/noExplicitAny: Event types from SDK not fully typed
			const props = (event as any).properties;
			const sessionID = props?.sessionID ?? props?.info?.id ?? "unknown";
			if (sessionID !== "unknown" && scannedSessions.has(sessionID)) return;

			try {
				logger.debug(`${branding.product_name}: starting session scan`, { sessionID });
				const scanHandler = createSessionScanHandler(
					logger,
					directory,
					(msg) => {
						pendingFindingsBySession.set(sessionID, msg);
					},
					branding,
				);
				await scanHandler();
				if (sessionID !== "unknown") {
					scannedSessions.add(sessionID);
				}
			} catch (error) {
				logger.error(`${branding.product_name} session scan failed (fail-open)`, {
					sessionID,
					error: String(error),
				});
			}
		},

		tool: {
			// TODO: After the following PR merged to support client V2 in Opencode Plugin, gitleaks:allow
			// use QuestionTools.ask to replace sage_approve tool
			// PR: https://github.com/anomalyco/opencode/pull/12046
			// Discussion: https://github.com/avast/sage/pull/21#discussion_r2873812399
			sage_approve: tool({
				description: `Approve or reject a ${branding.product_name}-flagged tool call. IMPORTANT: you MUST ask the user for explicit confirmation in the conversation BEFORE calling this tool. Never auto-approve - always present the flagged action and wait for the user to response.`,
				args: {
					actionId: tool.schema
						.string()
						.describe(`Action ID from ${branding.product_name} blocked message`),
					approved: tool.schema.boolean().describe("true to approve, false to reject"),
				},
				async execute(args: { actionId: string; approved: boolean }, _context) {
					if (!args.approved) {
						approvalStore.deletePending(args.actionId);
						return "Rejected by user.";
					}
					return approveAction(approvalStore, args.actionId, branding);
				},
			}),
		},
	};
};

export default SagePlugin;
