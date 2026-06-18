/**
 * Sage OpenCode plugin.
 * Intercepts tool calls and uses @gendigital/sage-core to enforce security verdicts.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	ApprovalStore,
	approveAction,
	checkAllowlistMigration,
	createOperationalLogger,
	formatAllowlistMigrationWarning,
	formatConfigurationWarnings,
	getConfigurationWarnings,
	loadConfig,
	resolveBranding,
} from "@gendigital/sage-core";
import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";
import { getBundledDataDirs } from "./bundled-dirs.js";
import { createSessionScanHandler } from "./startup-scan.js";
import { createToolHandlers } from "./tool-handler.js";

const APPROVAL_STORE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export const SagePlugin: Plugin = async ({ client, directory }) => {
	const config = await loadConfig();
	const operationalLogger = createOperationalLogger(config.operational_logging, "opencode");
	const logger = operationalLogger.forComponent("plugin");
	const toolLogger = operationalLogger.forComponent("tool-handler");
	const scanLogger = operationalLogger.forComponent("startup-scan");
	const branding = resolveBranding(config.brand_key, logger);
	const warningMessage = formatConfigurationWarnings(
		await getConfigurationWarnings(undefined, logger),
		branding,
	);
	if (warningMessage) {
		client.tui
			.showToast({
				body: { title: branding.name, message: warningMessage, variant: "warning", duration: 5000 },
			})
			.catch(() => {});
	}
	const allowlistMigration = await checkAllowlistMigration();
	if (allowlistMigration.needed) {
		client.tui
			.showToast({
				body: {
					title: branding.name,
					message: formatAllowlistMigrationWarning(allowlistMigration.entryTypes, branding),
					variant: "warning",
					duration: 8000,
				},
			})
			.catch(() => {});
	}
	const { threatsDir, trustedDomainsDir } = getBundledDataDirs();
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
		toolLogger,
		approvalStore,
		threatsDir,
		trustedDomainsDir,
		{
			showToast: (msg, variant) => {
				client.tui
					.showToast({
						body: { title: branding.name, message: msg, variant, duration: 5000 },
					})
					.catch(() => {});
			},
		},
		branding,
	);

	return {
		/**
		 * Register the Sage MCP server so sage_report_false_positive /
		 * sage_list_audit_entries are available as agent tools. OpenCode runs
		 * config hooks before MCP init, so mutating cfg.mcp here is sufficient.
		 * ??= ensures a user-supplied override in opencode.json is never clobbered.
		 */
		config: async (cfg) => {
			const dir = dirname(fileURLToPath(import.meta.url));
			const serverPath = join(dir, "mcp-server.cjs");
			// biome-ignore lint/suspicious/noExplicitAny: OpenCode Config.mcp types not exported
			const mcp = (cfg as any).mcp as Record<string, unknown> | undefined;
			if (mcp?.sage) return;
			// biome-ignore lint/suspicious/noExplicitAny: assigning McpLocalConfig without importing its type
			(cfg as any).mcp = {
				...mcp,
				sage: {
					type: "local",
					command: [process.execPath, serverPath],
					environment: { BUN_BE_BUN: "1", SAGE_AGENT_RUNTIME: "opencode" },
					enabled: true,
				},
			};
		},

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

			logger.debug(`Injected sage plugin scan findings to user message`, {
				sessionID,
				findingsLength: findings.length,
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
				logger.debug(`${branding.name}: starting session scan`, { sessionID });
				const scanHandler = createSessionScanHandler(
					scanLogger,
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
				logger.error(`${branding.name} session scan failed (fail-open)`, {
					sessionID,
					error: String(error),
				});
			}
		},

		tool: {
			sage_approve: tool({
				description: `Review a ${branding.name}-flagged tool call. Shows a native approval dialog to the user. Call this immediately when ${branding.name} flags an action — do NOT ask the user in chat first.`,
				args: {
					actionId: tool.schema
						.string()
						.describe(`Action ID from ${branding.name} flagged message`),
				},
				async execute(args: { actionId: string }, context) {
					const pending = approvalStore.getPending(args.actionId);
					if (!pending) {
						return `No pending ${branding.name} approval found for this action ID.`;
					}

					try {
						// "doom_loop" is the only permission OpenCode always gates with an ask dialog,
						// bypassing wildcard `*: allow` defaults. If OpenCode changes this, the dialog silently stops appearing.
						await context.ask({
							permission: "doom_loop",
							patterns: pending.artifacts.map((a) => `[${a.type}] ${a.value}`),
							always: [],
							metadata: {},
						});
					} catch (error) {
						logger.debug(`${branding.name}: approval dialog failed`, {
							actionId: args.actionId,
							error: String(error),
						});
						approvalStore.deletePending(args.actionId);
						logger.debug("OpenCode approval rejected", { actionId: args.actionId });
						return "Rejected by user.";
					}
					logger.info("OpenCode approval accepted", { actionId: args.actionId });

					return approveAction(approvalStore, args.actionId, branding);
				},
			}),
		},
	};
};

export default SagePlugin;
