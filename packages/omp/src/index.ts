/**
 * Sage Oh My Pi connector — hook entry point.
 *
 * Exported as the default (a `HookFactory`) so OMP's extension runner can
 * register the tool_call handler at session bootstrap.
 */

import { resolve } from "node:path";
import { type Logger, loadConfigSync, resolveBranding } from "@gendigital/sage-core";
import {
	createOutputScanHandlers,
	registerHookHandlers,
	resolveConnectorResources,
	type ToolCallContext,
} from "@gendigital/sage-hook-host";
import { mapToolCall } from "./extractors.js";
import type { HookFactory, HookLogger } from "./omp-types.js";
import { runOmpSessionScan } from "./session.js";

/** The bundle lives in `dist/`, so the package root is one level up. */
const packageRoot = resolve(__dirname, "..");
const resources = resolveConnectorResources(packageRoot);

/**
 * Adapts OMP's `pi.logger` to sage's `Logger`. The minimum supported release
 * is OMP 18.12, whose logger exports `info`, so sage's info stays info.
 */
function toSageLogger(pi: HookLogger): Logger {
	return {
		debug: (msg, data) => pi.debug(msg, data),
		info: (msg, data) => pi.info(msg, data),
		warn: (msg, data) => pi.warn(msg, data),
		error: (msg, data) => pi.error(msg, data),
	};
}

const factory: HookFactory = (pi) => {
	const logger = toSageLogger(pi.logger);
	// Resolve branding synchronously at registration time so the very first
	// verdict the user sees is already branded correctly — no async race.
	const branding = resolveBranding(loadConfigSync(undefined, logger).brand_key, logger);

	// Without rules the connector silently allows everything, which looks like a
	// clean run. Warn so that is easy to spot.
	const { threatsDir, trustedDomainsDir } = resources;
	if (resources.missing) {
		logger.warn(
			`${branding.name}: no bundled resources and no repo-root threats at ${threatsDir} — threat rules will not load`,
			{ threatsDir, trustedDomainsDir },
		);
	}

	const modelDownloadWorkerPath = resolve(packageRoot, "dist", "model-download-worker.cjs");
	const skillUploadWorkerPath = resolve(packageRoot, "dist", "skill-upload-worker.cjs");
	// OMP exposes no version to hooks: it ships as a compiled binary with no
	// importable module, no version field on the hook API, and no version env
	// var. Telemetry falls back to SAGE_AGENT_RUNTIME_VERSION.
	const agentRuntimeVersion = undefined;

	// PostToolUse: approval note, PI warning, output scan.
	const outputScan = createOutputScanHandlers({
		logger,
		branding,
		agentRuntime: "omp",
		agentRuntimeVersion,
		adapter: { mapToolCall },
		threatsDir,
		trustedDomainsDir,
	});

	// False when this host is already wired (reload / re-init), so the
	// connector-local handlers below are registered too.
	const registered = registerHookHandlers(pi, {
		agentRuntime: "omp",
		agentRuntimeVersion,
		adapter: { mapToolCall },
		packageRoot,
		threatsDir,
		trustedDomainsDir,
		logger,
		branding,
		extensions: {
			onApproved: outputScan.onApproved,
			onToolResult: outputScan.onToolResult,
		},
	});
	if (!registered) return;

	// OMP emits session_start before this factory runs, so agent_start is the
	// first usable event. Keyed by session id (as pi does) because the scan is
	// cwd- and session-specific: one long-lived process serves many sessions,
	// and project skill roots can differ between them. The model download it
	// triggers is idempotent, so re-running per session is cheap.
	const scannedSessions = new Set<string>();
	// Findings go through `notify`; the status line alone would lose them, as
	// the next tool call's verdict overwrites it and the scan has already
	// marked one-time notices as shown. The status line still gets a one-line
	// summary (hosts strip newlines from it).
	const deliverScanMessages = (ctx: ToolCallContext, messages: string[]): void => {
		if (messages.length === 0) return;
		logger.info(`${branding.name} session scan`, { messages });
		if (!ctx.hasUI || !ctx.ui) return;
		try {
			for (const message of messages) ctx.ui.notify?.(message, "info");
		} catch {
			// display-only
		}
		const summary = messages[0]?.replace(/\s+/g, " ").slice(0, 120) ?? "scan complete";
		try {
			ctx.ui.setStatus("sage", `🛡️ ${branding.name}: ${summary}`);
		} catch {
			// display-only
		}
	};
	pi.on("agent_start", async (_event: unknown, ctx: ToolCallContext) => {
		const sessionId = ctx.sessionManager?.getSessionId?.() ?? "unknown";
		if (scannedSessions.has(sessionId)) return undefined;
		scannedSessions.add(sessionId);
		void runOmpSessionScan({
			logger,
			branding,
			cwd: ctx.cwd ?? process.cwd(),
			agentRuntimeVersion,
			threatsDir,
			trustedDomainsDir,
			version: typeof __SAGE_VERSION__ === "string" ? __SAGE_VERSION__ : "0.0.0",
			modelDownloadWorkerPath,
			skillUploadWorkerPath,
		})
			.then((messages) => deliverScanMessages(ctx, messages))
			.catch((error) => {
				logger.error(`${branding.name} session scan failed (fail-open)`, {
					error: String(error),
				});
			});
		return undefined;
	});

	// Drop a session's scan latch when it ends so a long-lived process does not
	// accumulate ids forever, and a reused session id is scanned again.
	pi.on("session_shutdown", async (_event: unknown, ctx: ToolCallContext) => {
		const sessionId = ctx.sessionManager?.getSessionId?.() ?? "unknown";
		scannedSessions.delete(sessionId);
		return undefined;
	});

	pi.logger.debug(`${branding.name} hook registered`, { packageRoot });
};

declare const __SAGE_VERSION__: string;

export default factory;
