/**
 * Sage pi connector — extension entry point.
 *
 * pi loads the default-exported factory (via `pi install`, `pi -e`, or an
 * extensions directory) and calls it with its `ExtensionAPI`.
 *
 *   tool_call      → PreToolUse   (shared hook-host handler: allow / deny / ask)
 *   tool_result    → PostToolUse  (approval note, PI warnings, output scan)
 *   session_start  → SessionStart (plugin + skill scan, notices)
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { createOperationalLogger, loadConfigSync, resolveBranding } from "@gendigital/sage-core";
import {
	createOutputScanHandlers,
	registerHookHandlers,
	type ToolCallContext,
} from "@gendigital/sage-hook-host";
import { mapToolCall } from "./extractors.js";
import type { ExtensionFactory, PiSourceInfo, PiUI } from "./pi-types.js";
import {
	getPiRuntimeVersion,
	MCP_SERVER_PATH,
	PACKAGE_ROOT,
	PI_RUNTIME,
	RESOURCES_MISSING,
	THREATS_DIR,
	TRUSTED_DOMAINS_DIR,
} from "./runtime.js";
import { runSessionScan } from "./session.js";
import { createStatusLine } from "./status.js";

/**
 * pi's agent directory (default `~/.pi/agent`), mirroring pi's own `getAgentDir()`:
 * `PI_CODING_AGENT_DIR` is the only env var it reads (`config.ts`, `ENV_AGENT_DIR`).
 */
function piAgentDir(): string {
	return process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
}

const factory: ExtensionFactory = (pi) => {
	const config = loadConfigSync();
	const operational = createOperationalLogger(config.operational_logging, PI_RUNTIME);
	const logger = operational.forComponent("extension");
	// Resolve branding at registration time so the first verdict is branded.
	const branding = resolveBranding(config.brand_key, logger);

	const agentRuntimeVersion = getPiRuntimeVersion();

	// Without rules the connector silently allows everything, which looks like a
	// clean run. Warn so that is easy to spot.
	if (RESOURCES_MISSING) {
		logger.warn(
			`${branding.name}: no bundled resources and no repo-root threats at ${THREATS_DIR} — threat rules will not load`,
			{ threatsDir: THREATS_DIR, trustedDomainsDir: TRUSTED_DOMAINS_DIR },
		);
	}

	// Non-allow verdict counts plus fresh risky-skill findings. State lives in
	// core (~/.sage/statusline-*.txt); this only renders. With
	// `manage_status_line` off, the shared handler's one-line shield is used.
	const statusLine = config.manage_status_line ? createStatusLine(branding, config) : undefined;

	const outputScan = createOutputScanHandlers({
		logger: operational.forComponent("tool-handler"),
		branding,
		agentRuntime: PI_RUNTIME,
		agentRuntimeVersion,
		adapter: { mapToolCall },
		threatsDir: THREATS_DIR,
		trustedDomainsDir: TRUSTED_DOMAINS_DIR,
	});

	// False when this host is already wired (reload / re-init), so the
	// connector-local handlers below are registered too.
	const registered = registerHookHandlers(pi, {
		agentRuntime: PI_RUNTIME,
		agentRuntimeVersion,
		adapter: { mapToolCall },
		packageRoot: PACKAGE_ROOT,
		threatsDir: THREATS_DIR,
		trustedDomainsDir: TRUSTED_DOMAINS_DIR,
		logger: operational.forComponent("tool-handler"),
		branding,
		extensions: {
			onApproved: outputScan.onApproved,
			onToolResult: outputScan.onToolResult,
			...(statusLine
				? {
						// Return the write promise so the shared handler awaits it
						// before rendering — the render reads the same file back.
						onNonAllow: (sessionId: string, verdict) => statusLine.record(sessionId, verdict),
						// Fire-and-forget: rendering never blocks enforcement.
						renderStatus: (ctx: ToolCallContext) => void statusLine.render(ctx),
					}
				: {}),
		},
	});
	if (!registered) return;

	// sage_report_false_positive / sage_list_audit_entries. A user-defined
	// "sage" server wins; registration failure is fail-open.
	try {
		pi.registerMcpServer?.("sage", {
			command: process.execPath,
			args: [MCP_SERVER_PATH],
			env: { SAGE_AGENT_RUNTIME: PI_RUNTIME },
		});
	} catch (error) {
		logger.debug("Sage MCP server registration failed", { error: String(error) });
	}

	// One scan per session id; session_start also fires on reload/resume/fork,
	// and pi invalidates the previous ctx on reload. Everything is read from
	// pi/ctx synchronously, and results are delivered through whichever ctx is
	// current (a stale ctx throws).
	const scans = new Map<string, Promise<string[]>>();
	const delivered = new Set<string>();
	pi.on("session_start", async (_event: unknown, ctx: ToolCallContext) => {
		try {
			const sessionId = ctx.sessionManager?.getSessionId() ?? "unknown";
			if (statusLine) {
				void statusLine.start(sessionId).then(() => statusLine.render(ctx));
			}
			let scan = scans.get(sessionId);
			if (!scan) {
				const sources = [
					...(pi.getAllTools?.() ?? []).map((t) => t.sourceInfo),
					...(pi.getCommands?.() ?? []).map((c) => c.sourceInfo),
				].filter((s): s is PiSourceInfo => !!s);
				scan = runSessionScan({
					logger: operational.forComponent("startup-scan"),
					branding,
					agentDir: piAgentDir(),
					cwd: ctx.cwd ?? process.cwd(),
					sources,
					agentRuntimeVersion,
				}).catch((error) => {
					logger.error(`${branding.name} session scan failed (fail-open)`, {
						error: String(error),
					});
					return [] as string[];
				});
				scans.set(sessionId, scan);
			}

			// Don't hold up startup; deliver when the scan finishes.
			void scan.then((messages) => {
				// Skill verdicts may have landed during the scan — refresh the footer.
				void statusLine?.render(ctx);
				if (delivered.has(sessionId) || messages.length === 0) return;
				try {
					const ui = ctx.ui as PiUI | undefined;
					if (!ctx.hasUI || !ui?.notify) return;
					for (const m of messages) ui.notify(m, "info");
					delivered.add(sessionId);
				} catch {
					// ctx went stale (reload); the next session_start delivers.
				}
			});
		} catch (error) {
			logger.error(`${branding.name} session_start failed open`, { error: String(error) });
		}
		return undefined;
	});

	// A long-lived pi process sees many sessions; the per-session bookkeeping
	// above would otherwise grow for the life of the process.
	pi.on("session_shutdown", async (_event: unknown, ctx: ToolCallContext) => {
		const sessionId = ctx.sessionManager?.getSessionId() ?? "unknown";
		scans.delete(sessionId);
		delivered.delete(sessionId);
		return undefined;
	});

	logger.debug(`${branding.name} extension registered`, { packageRoot: PACKAGE_ROOT });
};

export default factory;
