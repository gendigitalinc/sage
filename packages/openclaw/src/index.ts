/**
 * Sage OpenClaw plugin entry point.
 * Registers before_tool_call handler, startup/session scan hooks,
 * and before_agent_start handler.
 */

import {
	ApprovalStore,
	createOperationalLogger,
	formatConfigurationWarnings,
	getConfigurationWarningsSync,
	loadConfigSync,
	resolveBranding,
} from "@gendigital/sage-core";
import { getBundledDataDirs } from "./bundled-dirs.js";
import {
	createBeforeAgentStartHandler,
	createSessionScanHandler,
	createStartupScanHandler,
} from "./startup-scan.js";
import { createToolCallHandler } from "./tool-handler.js";

interface PluginApi {
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
		const operationalLogger = createOperationalLogger(config.operational_logging, "openclaw");
		const logger = operationalLogger.forComponent("plugin");
		const toolLogger = operationalLogger.forComponent("tool-handler");
		const scanLogger = operationalLogger.forComponent("startup-scan");
		const approvalStore = new ApprovalStore();
		const { threatsDir, allowlistsDir } = getBundledDataDirs();

		const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
		const interval = setInterval(() => approvalStore.cleanup(), CLEANUP_INTERVAL_MS);
		if (typeof interval.unref === "function") interval.unref();

		// Shared state: warnings/findings waiting to be surfaced to the user.
		let pendingConfigurationWarnings =
			formatConfigurationWarnings(getConfigurationWarningsSync(undefined, logger), branding) ??
			null;
		let pendingScanFindings: string | null = null;
		const onFindings = (msg: string) => {
			pendingScanFindings = msg;
		};
		const getPendingFindings = () =>
			[pendingConfigurationWarnings, pendingScanFindings].filter(Boolean).join("\n\n") || null;

		api.on(
			"before_tool_call",
			createToolCallHandler(approvalStore, toolLogger, threatsDir, allowlistsDir, branding),
			{ priority: 100 },
		);
		api.on("gateway_start", createStartupScanHandler(scanLogger, branding, onFindings));
		api.on("session_start", createSessionScanHandler(scanLogger, branding, onFindings));
		api.on(
			"before_agent_start",
			createBeforeAgentStartHandler(
				getPendingFindings,
				() => {
					pendingConfigurationWarnings = null;
					pendingScanFindings = null;
				},
				logger,
				branding,
			),
		);
	},
};
