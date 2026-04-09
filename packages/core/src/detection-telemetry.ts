/**
 * Community IQ detection telemetry.
 * Sends an awaited JSON POST to /v2/detection on qualifying deny paths.
 * Payload uses the same schema shape as FP reports but is populated
 * independently from live detection context.
 */

import { resolveEndpoint } from "./clients/url-check.js";
import { getInstallationId } from "./installation-id.js";
import { buildSageProxyEnvelope } from "./sage-proxy.js";
import type { AgentRuntime, AuditSignals, HookType, Logger } from "./types.js";
import { nullLogger } from "./types.js";
import { VERSION } from "./version.js";

const MAX_EFFECTIVE_TIMEOUT_MS = 1000;
const DEFAULT_TIMEOUT_MS = 1000;

// ── Canonical tool vocabulary ──────────────────────────────────────

type CanonicalToolType =
	| "Bash"
	| "WebFetch"
	| "Write"
	| "Edit"
	| "Read"
	| "Delete"
	| "ApplyPatch"
	| "Glob"
	| "Grep"
	| "List"
	| "CodeSearch"
	| "WebSearch"
	| "Question"
	| "Task"
	| "ReadLines"
	| "MCP"
	| "Unknown";

// ── Normalization maps per agent runtime ───────────────────────────

const OPENCLAW_MAP: Record<string, CanonicalToolType> = {
	bash: "Bash",
	exec: "Bash",
	web_fetch: "WebFetch",
	write: "Write",
	edit: "Edit",
	read: "Read",
	apply_patch: "ApplyPatch",
};

const OPENCODE_MAP: Record<string, CanonicalToolType> = {
	bash: "Bash",
	webfetch: "WebFetch",
	write: "Write",
	edit: "Edit",
	read: "Read",
	glob: "Glob",
	grep: "Grep",
	ls: "List",
	codesearch: "CodeSearch",
	websearch: "WebSearch",
	question: "Question",
	task: "Task",
	read_lines: "ReadLines",
};

const CANONICAL_SET = new Set<string>([
	"Bash",
	"WebFetch",
	"Write",
	"Edit",
	"Read",
	"Delete",
	"ApplyPatch",
	"Glob",
	"Grep",
	"List",
	"CodeSearch",
	"WebSearch",
	"Question",
	"Task",
	"ReadLines",
	"MCP",
	"Unknown",
]);

// ── Canonicalization helper ────────────────────────────────────────

export interface NormalizedTelemetryContext {
	toolType: CanonicalToolType;
	content: Record<string, unknown>;
}

/**
 * Maps connector-native toolName + toolInput to canonical tool type
 * and schema-compatible content fields for telemetry.
 */
export function normalizeDetectionTelemetryContext(
	agentRuntime: AgentRuntime | string | undefined,
	toolName: string,
	toolInput: Record<string, unknown>,
): NormalizedTelemetryContext {
	const toolType = canonicalizeToolName(agentRuntime, toolName);
	const content = buildContent(toolType, toolInput);
	return { toolType, content };
}

function canonicalizeToolName(
	agentRuntime: AgentRuntime | string | undefined,
	toolName: string,
): CanonicalToolType {
	if (CANONICAL_SET.has(toolName)) return toolName as CanonicalToolType;

	if (agentRuntime === "openclaw") {
		return OPENCLAW_MAP[toolName] ?? "Unknown";
	}
	if (agentRuntime === "opencode") {
		return OPENCODE_MAP[toolName] ?? "Unknown";
	}

	return "Unknown";
}

function asString(v: unknown): string | undefined {
	return typeof v === "string" ? v : undefined;
}

function buildContent(
	toolType: CanonicalToolType,
	toolInput: Record<string, unknown>,
): Record<string, unknown> {
	const content: Record<string, unknown> = {};

	switch (toolType) {
		case "Bash": {
			const command = asString(toolInput.command);
			if (command) content.command = command;
			break;
		}
		case "WebFetch": {
			const url = asString(toolInput.url);
			if (url) content.url = url;
			break;
		}
		case "Write":
		case "Edit":
		case "Read":
		case "Delete": {
			const filePath =
				asString(toolInput.file_path) ?? asString(toolInput.filePath) ?? asString(toolInput.path);
			if (filePath) content.file_path = filePath;
			break;
		}
	}

	const packageName = asString(toolInput.package_name);
	if (packageName) content.package_name = packageName;

	const packageVersion = asString(toolInput.package_version);
	if (packageVersion) content.package_version = packageVersion;

	const packageRegistry = asString(toolInput.package_registry);
	if (packageRegistry) content.package_registry = packageRegistry;

	return content;
}

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
	toolName: string;
	toolInput: Record<string, unknown>;
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

	const { toolType, content } = normalizeDetectionTelemetryContext(
		args.agentRuntime,
		args.toolName,
		args.toolInput,
	);

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
			tool_type: toolType,
			verdict: "deny",
			user_action: "blocked",
			timestamp: new Date().toISOString(),
			...(args.signals && Object.keys(args.signals).length > 0 ? { signals: args.signals } : {}),
			content,
		},
		event_id: args.eventId,
		comment: "",
	};

	const timeoutMs = resolveTimeoutMs();

	try {
		const response = await fetch(resolveEndpoint("/v2/detection"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(timeoutMs),
		});

		if (!response.ok) {
			logger.debug(`Detection telemetry HTTP ${response.status}`);
		}
	} catch (err) {
		logger.debug(`Detection telemetry send failed: ${err}`);
	}
}
