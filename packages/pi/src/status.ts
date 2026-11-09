/**
 * Status line for the pi footer: blocked/flagged counts, the most recent
 * reason, and fresh HIGH/CRITICAL skill findings — parity with the Claude Code
 * connector's sage-statusline.
 *
 * pi renders status natively through `ctx.ui.setStatus()`, so there is no
 * settings.json handoff. Core owns the per-session state file
 * (~/.sage/statusline-<id>.txt): `updateSessionStatus()` writes it on non-allow
 * verdicts, `readSessionStatus()` reads it back here. Enabled by
 * `manage_status_line` in ~/.sage/config.json (default on).
 */

import {
	type Branding,
	type Config,
	foreignSourceRuntime,
	formatStatusLine,
	initSessionStatus,
	loadSkillVerdictCacheSync,
	readSessionStatus,
	riskyVerdictsSince,
	type SkillWarning,
	updateSessionStatus,
	type Verdict,
} from "@gendigital/sage-core";
import type { ToolCallContext } from "@gendigital/sage-hook-host";
import { PI_RUNTIME } from "./runtime.js";

/**
 * How long a fresh skill verdict stays on the status line. pi re-renders on
 * each tool event; 10s matches the Claude Code statusline window so a finding
 * is visible for at least one refresh. Local to this connector — core does
 * not own it, so Claude Code's own copy is unchanged.
 */
const SKILL_WARNING_WINDOW_MS = 10_000;

/** HIGH/CRITICAL skill findings for pi since session start, within the window. */
function resolveSkillWarning(startedAt: string): SkillWarning | undefined {
	try {
		const windowStart = new Date(Date.now() - SKILL_WARNING_WINDOW_MS).toISOString();
		const laterIso = startedAt > windowStart ? startedAt : windowStart;
		const risky = riskyVerdictsSince(loadSkillVerdictCacheSync(), laterIso).filter(
			(v) => !foreignSourceRuntime(v.sources, PI_RUNTIME),
		);
		if (risky.length === 0) return undefined;
		const names = risky
			.map((v) => v.skillName?.trim())
			.filter((n): n is string => n !== undefined && n !== "");
		return { count: risky.length, names };
	} catch {
		return undefined;
	}
}

/** Same key the shared handler uses, so the counts line replaces the shield. */
const STATUS_KEY = "sage";

export interface StatusLine {
	/**
	 * Records a non-allow verdict into the session status file. Returns the
	 * write promise (resolving even on failure — display state must never
	 * affect enforcement) so callers can await it before rendering.
	 */
	record(sessionId: string, verdict: Verdict): Promise<void>;
	/** Establish a clean status file for a new session. */
	start(sessionId: string): Promise<void>;
	/** Render the current status into the footer (no-op without a UI). */
	render(ctx: ToolCallContext): Promise<void>;
}

export function createStatusLine(branding: Branding, config: Config): StatusLine {
	return {
		record(sessionId, verdict) {
			return updateSessionStatus(sessionId, verdict).catch(() => {
				// Display-only state; a failure must never affect enforcement.
			});
		},

		start(sessionId) {
			return initSessionStatus(sessionId).catch(() => {});
		},

		async render(ctx) {
			try {
				// Footer rendering only exists with a UI (TUI / RPC).
				if (!ctx.hasUI || !ctx.ui) return;
				const sessionId = ctx.sessionManager?.getSessionId() ?? "unknown";
				const status = await readSessionStatus(sessionId);
				const warning =
					config.skill_check.enabled && status?.startedAt
						? resolveSkillWarning(status.startedAt)
						: undefined;
				ctx.ui.setStatus(
					STATUS_KEY,
					formatStatusLine(
						status?.denied ?? 0,
						status?.flagged ?? 0,
						status?.lastReason ?? null,
						status?.lastCategory ?? null,
						branding,
						warning,
					),
				);
			} catch {
				// Display-only; never affects enforcement.
			}
		},
	};
}
