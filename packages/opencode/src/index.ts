/**
 * Sage OpenCode plugin.
 * Intercepts tool calls and uses @gendigital/sage-core to enforce security verdicts.
 *
 * One entry point serves both OpenCode generations:
 * - v1 (`opencode` 1.x) reads `default.server` (the `{ id, server }` module
 *   shape) and calls it with `(input, options)`.
 * - v2 (opencode2 / `@opencode-ai/core`) decodes `default` as `{ id, setup }`
 *   and calls `setup(context)`; extra keys are ignored by both loaders.
 *
 * The default export must stay a plain object: v2 rejects a function there.
 * Keep every other export a v1 plugin function — legacy v1 loaders call each
 * module export as a plugin and throw on anything else.
 */

import type { Branding } from "@gendigital/sage-core";
import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";
import {
	approvalPatterns,
	createSageController,
	SAGE_MCP_SERVER_NAME,
	SAGE_PLUGIN_ID,
	sageMcpServerConfig,
	type ToastFn,
} from "./shared.js";
import { setupV2 } from "./v2.js";

const DEFAULT_TOAST_DURATION_MS = 5000;

/** OpenCode v1 plugin function (`(input, options) => Hooks`). */
export const SagePlugin: Plugin = async ({ client, directory }) => {
	const createNotifier =
		(branding: Branding): ToastFn =>
		(msg, variant, durationMs = DEFAULT_TOAST_DURATION_MS) => {
			client.tui
				.showToast({ body: { title: branding.name, message: msg, variant, duration: durationMs } })
				.catch(() => {});
		};
	const sage = await createSageController({ directory, createNotifier, host: "v1" });

	return {
		/**
		 * Register the Sage MCP server so sage_report_false_positive /
		 * sage_list_audit_entries are available as agent tools. OpenCode runs
		 * config hooks before MCP init, so mutating cfg.mcp here is sufficient.
		 * A user-supplied `sage` entry in opencode.json is never clobbered.
		 */
		config: async (cfg) => {
			// biome-ignore lint/suspicious/noExplicitAny: OpenCode Config.mcp types not exported
			const mcp = (cfg as any).mcp as Record<string, unknown> | undefined;
			if (mcp?.[SAGE_MCP_SERVER_NAME]) return;
			// biome-ignore lint/suspicious/noExplicitAny: assigning McpLocalConfig without importing its type
			(cfg as any).mcp = {
				...mcp,
				[SAGE_MCP_SERVER_NAME]: { ...sageMcpServerConfig(), enabled: true },
			};
		},

		"tool.execute.before": sage.beforeToolUse,

		// Run the session scan on the first session.updated event. It discovers
		// skills, populates the verdict cache, and (post-scan, once the TUI is up)
		// shows the summary popup. OpenCode >=1.3 replaced session.created with
		// session.updated. Dedupe + the work live in scanSession.
		event: async ({ event }) => {
			if (event.type !== "session.updated") return;
			// biome-ignore lint/suspicious/noExplicitAny: Event types from SDK not fully typed
			const props = (event as any).properties;
			const sessionID = props?.sessionID ?? props?.info?.id ?? "unknown";
			await sage.scanSession(sessionID);
		},

		tool: {
			sage_approve: tool({
				description: sage.approveToolDescription,
				args: {
					actionId: tool.schema.string().describe(sage.approveArgDescription),
				},
				async execute(args: { actionId: string }, context) {
					return sage.resolveApproval(args.actionId, async (pending) => {
						// "doom_loop" is the only permission OpenCode always gates with an ask dialog,
						// bypassing wildcard `*: allow` defaults. If OpenCode changes this, the dialog silently stops appearing.
						await context.ask({
							permission: "doom_loop",
							patterns: approvalPatterns(pending),
							always: [],
							metadata: {},
						});
					});
				},
			}),
		},
	};
};

/**
 * Dual-host plugin definition: `server` for OpenCode v1, `setup` for v2,
 * both behind the same stable `id`.
 */
const sagePluginModule = {
	id: SAGE_PLUGIN_ID,
	server: SagePlugin,
	setup: setupV2,
};

export default sagePluginModule;
