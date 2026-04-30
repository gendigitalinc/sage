/**
 * Sage OpenClaw plugin entry point.
 * Registers before_tool_call handler, startup/session scan hooks,
 * and before_agent_start handler.
 */

import { ApprovalStore, loadConfigSync, resolveBranding } from "@gendigital/sage-core";
import { getBundledDataDirs } from "./bundled-dirs.js";
import { createLogger, type PluginLogger } from "./logger-adapter.js";
import {
	createBeforeAgentStartHandler,
	createSessionScanHandler,
	createStartupScanHandler,
} from "./startup-scan.js";
import { createToolCallHandler } from "./tool-handler.js";

interface PluginApi {
	logger: PluginLogger;
	// biome-ignore lint/suspicious/noExplicitAny: OpenClaw handler signatures vary by event
	on(event: string, handler: (...args: any[]) => any, options?: { priority?: number }): void;
}

// Load branding at module scope so the plugin registration name reflects the brand.
// Uses loadConfigSync because branding depends on config.brand_key and this runs
// before any async init (OpenClaw reads `name` from the default export at import time).
const config = loadConfigSync();
const branding = resolveBranding(config.brand_key);

export default {
	id: "sage-openclaw",
	name: branding.name,
	description: "Safety for Agents — ADR layer that guards commands, files, and web requests",
	configSchema: {
		jsonSchema: { type: "object", additionalProperties: false, properties: {} },
	},
	register(api: PluginApi) {
		const logger = createLogger(api.logger);
		const approvalStore = new ApprovalStore();
		const { threatsDir, allowlistsDir } = getBundledDataDirs();

		const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
		const interval = setInterval(() => approvalStore.cleanup(), CLEANUP_INTERVAL_MS);
		if (typeof interval.unref === "function") interval.unref();

		// Shared state: scan findings waiting to be surfaced to the user
		let pendingFindings: string | null = null;
		const onFindings = (msg: string) => {
			pendingFindings = msg;
		};

		api.on(
			"before_tool_call",
			createToolCallHandler(approvalStore, logger, threatsDir, allowlistsDir, branding),
			{ priority: 100 },
		);
		api.on("gateway_start", createStartupScanHandler(logger, branding, onFindings));
		api.on("session_start", createSessionScanHandler(logger, branding, onFindings));
		api.on(
			"before_agent_start",
			createBeforeAgentStartHandler(
				() => pendingFindings,
				() => {
					pendingFindings = null;
				},
				logger,
				branding,
			),
		);
	},
};
