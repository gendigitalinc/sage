/**
 * Audit logger for Sage verdicts.
 * Appends JSON Lines entries to ~/.sage/audit.jsonl for forensics and debugging.
 */

import { randomUUID } from "node:crypto";
import { appendFile, mkdir, rename, stat, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { resolvePath } from "./config.js";
import { getFileContent } from "./file-utils.js";
import type {
	AgentRuntime,
	AuditSignals,
	HookType,
	LoggingConfig,
	PiCheckConfig,
	Verdict,
} from "./types.js";

/**
 * Structured input to {@link logVerdict}. Replaces the previous 11-parameter
 * positional signature so call sites can omit unused fields by name and
 * future telemetry additions don't reorder existing arguments.
 *
 * `content` is the structured snapshot produced by `buildContentSnapshot`
 * (in `content-snapshot.ts`). `audit-log.ts` deliberately does not import
 * the builder — the evaluator constructs `content` once, then passes the
 * opaque object to both this function and `sendCommunityIqDetection`.
 */
export interface VerdictLogEntry {
	sessionId: string;
	toolName: string;
	toolInput: Record<string, unknown>;
	verdict: Verdict;
	userOverride?: boolean;
	conversationId?: string;
	agentRuntime?: AgentRuntime;
	hookType?: HookType;
	signals?: AuditSignals;
	content?: Record<string, unknown>;
	eventId?: string;
	toolUseId?: string;
}

const MAX_SUMMARY_LEN = 200;

/**
 * Schema version stamped on every audit log entry by {@link appendEntry}.
 *
 * Bump this whenever the on-disk shape of a `runtime_verdict` or
 * `plugin_scan` entry changes in a backwards-incompatible way (renamed/
 * removed top-level keys, semantically repurposed fields, narrower
 * value domains, etc.). Additive changes — new optional fields, new
 * `type` values, new entries inside `signals`/`content` — do NOT
 * require a bump because readers (`getRecentEntries`, the FP tool's
 * `parseAuditSignals`, etc.) all tolerate unknown keys.
 *
 * Exported so downstream consumers (tests, schema validators, future
 * audit-log readers that want to gate on the writer's version) can
 * reference the symbolic value instead of duplicating the literal —
 * a bump here then propagates without churn elsewhere. Production
 * callers MUST NOT stamp `schema_version` themselves: `appendEntry`
 * is the single chokepoint that injects it, and a manually-set value
 * in a caller's entry literal would be silently overwritten anyway.
 */
export const AUDIT_LOG_SCHEMA_VERSION = 1;

function toolInputSummary(toolName: string, toolInput: Record<string, unknown>): string {
	if (toolName === "Bash") {
		return String(toolInput.command ?? "").slice(0, MAX_SUMMARY_LEN);
	}
	if (toolName === "WebFetch") {
		return String(toolInput.url ?? "").slice(0, MAX_SUMMARY_LEN);
	}
	if (toolName === "Write" || toolName === "Edit" || toolName === "Read" || toolName === "Delete") {
		return String(toolInput.file_path ?? "").slice(0, MAX_SUMMARY_LEN);
	}
	return JSON.stringify(toolInput).slice(0, MAX_SUMMARY_LEN);
}

/**
 * Classic logrotate: shift numbered backups and rename active file to .1.
 * All renames wrapped in try/catch ignoring ENOENT for race safety.
 */
async function rotateIfNeeded(filePath: string, maxBytes: number, maxFiles: number): Promise<void> {
	if (maxBytes <= 0 || maxFiles <= 0) return;

	let size: number;
	try {
		const s = await stat(filePath);
		size = s.size;
	} catch {
		return; // File doesn't exist yet
	}

	if (size < maxBytes) return;

	// Delete oldest backup
	try {
		await unlink(`${filePath}.${maxFiles}`);
	} catch {
		// ENOENT OK
	}

	// Shift .N-1 → .N down to .1 → .2
	for (let i = maxFiles - 1; i >= 1; i--) {
		try {
			await rename(`${filePath}.${i}`, `${filePath}.${i + 1}`);
		} catch {
			// ENOENT OK
		}
	}

	// Active → .1
	try {
		await rename(filePath, `${filePath}.1`);
	} catch {
		// ENOENT OK (race: another process already renamed)
	}
}

async function appendEntry(config: LoggingConfig, entry: Record<string, unknown>): Promise<void> {
	const path = resolvePath(config.path);
	await mkdir(dirname(path), { recursive: true });
	await rotateIfNeeded(path, config.max_bytes, config.max_files);
	// `schema_version` is stamped here — the single chokepoint for every
	// audit write — so callers (logVerdict, logPluginScan, future entry
	// types) cannot accidentally omit it. Spread last so this assignment
	// is authoritative even if a future caller mistakenly sets the field
	// in their entry literal.
	const stamped = { ...entry, schema_version: AUDIT_LOG_SCHEMA_VERSION };
	await appendFile(path, `${JSON.stringify(stamped)}\n`);
}

export async function logVerdict(config: LoggingConfig, input: VerdictLogEntry): Promise<void> {
	if (!config.enabled) return;

	const userOverride = input.userOverride ?? false;
	const hasSignals = input.signals != null && Object.keys(input.signals).length > 0;
	// Skip clean verdicts unless log_clean is on, user overrode, or signals fired
	if (input.verdict.decision === "allow" && !config.log_clean && !userOverride && !hasSignals)
		return;

	const entry: Record<string, unknown> = {
		type: "runtime_verdict",
		entry_id: input.eventId ?? randomUUID(),
		timestamp: new Date().toISOString(),
		session_id: input.sessionId,
		conversation_id: input.conversationId ?? input.sessionId,
		agent_runtime: input.agentRuntime,
		hook_type: input.hookType,
		tool_name: input.toolName,
		tool_input_summary: toolInputSummary(input.toolName, input.toolInput),
		artifacts: input.verdict.artifacts,
		verdict: input.verdict.decision,
		severity: input.verdict.severity,
		reasons: input.verdict.reasons,
		source: input.verdict.source,
		user_override: userOverride,
		signals: input.signals,
		tool_use_id: input.toolUseId,
	};
	// `content` is omitted entirely (not written as `null`) when the evaluator
	// produced no structured snapshot — keeps legacy entries and "nothing to
	// extract" entries indistinguishable on disk.
	if (input.content !== undefined) {
		entry.content = input.content;
	}

	try {
		await appendEntry(config, entry);
	} catch {
		// Fail-open: logging errors swallowed
	}
}

export async function logPluginScan(
	config: LoggingConfig,
	pluginKey: string,
	pluginVersion: string,
	findings: Record<string, unknown>[],
): Promise<void> {
	if (!config.enabled) return;

	const entry = {
		type: "plugin_scan",
		timestamp: new Date().toISOString(),
		plugin_key: pluginKey,
		plugin_version: pluginVersion,
		findings_count: findings.length,
		findings,
	};

	try {
		await appendEntry(config, entry);
	} catch {
		// Fail-open
	}
}

export async function findPiWarningInAuditLog(
	loggingConfig: LoggingConfig,
	toolUseId: string,
	piConfig: PiCheckConfig,
): Promise<{ risk: number; contentName: string } | null> {
	const entries = await getRecentEntries(loggingConfig, 20);
	for (const raw of entries.reverse()) {
		const e = raw as Record<string, unknown>;
		if (e.tool_use_id !== toolUseId) continue;
		const signals = e.signals as
			| { pi_checks?: { risk: number; content_name: string }[] }
			| undefined;
		const pi = signals?.pi_checks?.[0];
		if (pi && pi.risk >= piConfig.medium_risk_threshold && pi.risk < piConfig.high_risk_threshold) {
			return { risk: pi.risk, contentName: pi.content_name };
		}
		break;
	}
	return null;
}

export async function getRecentEntries(config: LoggingConfig, limit = 100): Promise<unknown[]> {
	const path = resolvePath(config.path);

	try {
		const content = await getFileContent(path);
		const lines = content.trim().split("\n");
		const recent = lines.slice(-limit);
		const entries: unknown[] = [];
		for (const line of recent) {
			try {
				entries.push(JSON.parse(line));
			} catch {}
		}
		return entries;
	} catch {
		return [];
	}
}
