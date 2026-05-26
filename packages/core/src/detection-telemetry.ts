/**
 * Community IQ detection telemetry.
 * Sends an awaited JSON POST to /v2/detection on qualifying deny paths.
 * Payload uses the same schema shape as FP reports but is populated
 * independently from live detection context.
 *
 * The structured `content` snapshot is built once by the evaluator (via
 * `buildContentSnapshot` in `content-snapshot.ts`) and threaded into both
 * `logVerdict` and this function. This module deliberately does not import
 * the snapshot builder — it sends `args.content` verbatim.
 */

import { resolveEndpoint } from "./clients/url-check.js";
import { loadExtendedInfo, mergeExtendedInfo } from "./extended-info.js";
import { getInstallationId } from "./installation-id.js";
import { buildSageProxyEnvelope } from "./sage-proxy.js";
import type { CanonicalToolType } from "./tool-names.js";
import type { AgentRuntime, AuditSignals, HookType, Logger } from "./types.js";
import { nullLogger } from "./types.js";
import { VERSION } from "./version.js";

const MAX_EFFECTIVE_TIMEOUT_MS = 1000;
const DEFAULT_TIMEOUT_MS = 1000;

// ── Timeout resolution ─────────────────────────────────────────────

function resolveTimeoutMs(): number {
	const envVal = process.env.SAGE_COMMUNITY_IQ_TIMEOUT_SECONDS;
	if (envVal === undefined || envVal === "") return DEFAULT_TIMEOUT_MS;

	const parsed = Number.parseFloat(envVal);
	if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;

	const ms = Math.floor(parsed * 1000);
	return Math.min(ms, MAX_EFFECTIVE_TIMEOUT_MS);
}

// ── Detection payload & sender ─────────────────────────────────────

export interface DetectionTelemetryArgs {
	eventId: string;
	agentRuntime: AgentRuntime | string | undefined;
	agentRuntimeVersion?: string;
	hookType?: HookType;
	toolName: CanonicalToolType;
	/**
	 * Pre-built content snapshot from `buildContentSnapshot`. Sent verbatim
	 * in the `block_event.content` field of the detection payload. When
	 * absent or empty the payload includes `content: {}` rather than omitting
	 * the field, matching the historical schema shape.
	 */
	content?: Record<string, unknown>;
	signals?: AuditSignals;
	communityIqEnabled: boolean;
	logger?: Logger;
}

/**
 * Send Community IQ detection telemetry for a qualifying deny verdict.
 * Sends an awaited POST with a capped timeout. Never throws.
 */
export async function sendCommunityIqDetection(args: DetectionTelemetryArgs): Promise<void> {
	const logger = args.logger ?? nullLogger;

	if (!args.communityIqEnabled) {
		logger.debug("Community IQ disabled, skipping detection telemetry");
		return;
	}

	let iid: string | undefined;
	try {
		iid = await getInstallationId();
	} catch {
		// fail-open
	}
	if (!iid) {
		logger.debug("Skipping detection telemetry: missing installation id");
		return;
	}

	const envelope = buildSageProxyEnvelope({
		iid,
		versionApp: VERSION,
		agentRuntime: args.agentRuntime ?? "unknown",
		agentRuntimeVersion:
			args.agentRuntimeVersion ?? process.env.SAGE_AGENT_RUNTIME_VERSION ?? "unknown",
	});

	const payload = {
		...envelope,
		block_event: {
			hook_type: args.hookType ?? "PreToolUse",
			// `args.toolName` is canonical (`CanonicalToolType`) — connectors
			// canonicalize before calling `evaluateToolCall`, so no further
			// mapping is needed here.
			tool_type: args.toolName,
			verdict: "deny",
			user_action: "blocked",
			timestamp: new Date().toISOString(),
			...(args.signals && Object.keys(args.signals).length > 0 ? { signals: args.signals } : {}),
			content: args.content ?? {},
		},
		event_id: args.eventId,
		comment: "",
	};

	// Optional extended-info enrichment. Fail-open: any error inside the
	// loader yields `null`, leaving the payload unchanged.
	const extendedInfo = await loadExtendedInfo(undefined, logger).catch(() => null);
	const enriched = mergeExtendedInfo(payload as unknown as Record<string, unknown>, extendedInfo);

	const timeoutMs = resolveTimeoutMs();

	try {
		const response = await fetch(resolveEndpoint("/v2/detection"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(enriched),
			signal: AbortSignal.timeout(timeoutMs),
		});

		if (!response.ok) {
			logger.warn("Detection telemetry send failed", {
				eventId: args.eventId,
				status: response.status,
			});
		} else {
			logger.debug("Detection telemetry sent", {
				eventId: args.eventId,
				toolName: args.toolName,
				hookType: args.hookType ?? "PreToolUse",
			});
		}
	} catch (err) {
		logger.warn("Detection telemetry send failed", {
			eventId: args.eventId,
			error: String(err),
		});
	}
}
