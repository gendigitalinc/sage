import { randomUUID } from "node:crypto";
import {
	type Branding,
	buildSageProxyEnvelope,
	buildSkillCheckSignal,
	defaultBranding,
	getInstallationId,
	getRecentEntries,
	type HookType,
	isFreshTimestamp,
	isSkillId,
	type Logger,
	loadConfig,
	loadExtendedInfo,
	loadSkillVerdictCacheReadOnly,
	mergeExtendedInfo,
	readProductJsonVersion,
	resolveEndpoint,
	resolveSkillVerdictEntryId,
	skillCacheTtlMs,
} from "@gendigital/sage-core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { textResult } from "./utils.js";

type AuditRuntimeVerdictEntry = {
	type?: unknown;
	entry_id?: unknown;
	timestamp?: unknown;
	session_id?: unknown;
	conversation_id?: unknown;
	agent_runtime?: unknown;
	tool_name?: unknown;
	tool_input_summary?: unknown;
	artifacts?: unknown;
	verdict?: unknown;
	severity?: unknown;
	reasons?: unknown;
	source?: unknown;
	user_override?: unknown;
	signals?: unknown;
	content?: unknown;
	content_snippet?: unknown;
	hook_type?: unknown;
};

type AuditSkillVerdictEntry = {
	type?: unknown;
	entry_id?: unknown;
	timestamp?: unknown;
	agent_runtime?: unknown;
	skill_id?: unknown;
	job_id?: unknown;
	status?: unknown;
	verdict?: unknown;
	summary?: unknown;
	signals?: unknown;
};

function asString(v: unknown): string | undefined {
	return typeof v === "string" ? v : undefined;
}

/**
 * Resolve the host agent runtime version once at module load.
 *
 * The MCP server runs as a child process spawned by the IDE; it has no access
 * to `vscode.version` or `vscode.env.appRoot`. Instead the extension injects
 * the application root via the `SAGE_APP_ROOT` env var (see
 * `mcp_config_installer.ts`), and we read `product.json` from there. This
 * matches the resolution strategy used by the hook runner (`sage-hook.ts`),
 * so heartbeats, detection telemetry, and FP reports all converge on the
 * same value for a given host install.
 *
 * `readProductJsonVersion` is fail-open and returns the string `"unknown"`
 * when `product.json` is missing, unreadable, malformed, or lacks a `version`
 * field. We collapse that sentinel into `undefined` here so the downstream
 * `?? process.env.SAGE_AGENT_RUNTIME_VERSION ?? "unknown"` cascade can fall
 * through to the env-var override; otherwise a stale or stripped `appRoot`
 * would pin every FP report's `agent_runtime_version` to `"unknown"` and
 * silently break runtime-version correlation in the backend.
 *
 * Resolved once because the value cannot change without a host restart, and
 * a host restart re-spawns the MCP server.
 */
const HOST_AGENT_RUNTIME_VERSION = (() => {
	const appRoot = process.env.SAGE_APP_ROOT;
	if (!appRoot) return undefined;
	const resolved = readProductJsonVersion(appRoot);
	return resolved === "unknown" ? undefined : resolved;
})();

/**
 * Read the structured `content` snapshot stored in a runtime_verdict audit
 * entry. The snapshot is produced by `buildContentSnapshot` in core (caps,
 * home-path scrubbing, deterministic multi-value selection all applied
 * upstream) and persisted verbatim by `logVerdict`. The FP tool reads it
 * directly with no reconstruction. Legacy entries without a `content` field
 * produce an empty object here, which payload construction omits entirely.
 */
function readContent(entry: AuditRuntimeVerdictEntry): Record<string, unknown> {
	const raw = entry.content;
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
	return raw as Record<string, unknown>;
}

function readContentSnippet(entry: AuditRuntimeVerdictEntry): string | undefined {
	return asString(entry.content_snippet);
}

function isRuntimeVerdictEntry(v: unknown): v is AuditRuntimeVerdictEntry {
	if (!v || typeof v !== "object" || Array.isArray(v)) return false;
	return (v as Record<string, unknown>).type === "runtime_verdict";
}

/** A skill_verdict entry whose `skill_id` the guards below have already validated. */
type AnalyzedSkillVerdictEntry = AuditSkillVerdictEntry & { skill_id: string };

function isAnalyzedSkillVerdictEntry(v: unknown): v is AnalyzedSkillVerdictEntry {
	if (!v || typeof v !== "object" || Array.isArray(v)) return false;
	const entry = v as Record<string, unknown>;
	return (
		entry.type === "skill_verdict" &&
		entry.status === "analyzed" &&
		isSkillId(asString(entry.skill_id) ?? "")
	);
}

function isReportableSkillVerdictEntry(v: unknown): v is AnalyzedSkillVerdictEntry {
	if (!isAnalyzedSkillVerdictEntry(v)) return false;
	const entry = v as Record<string, unknown>;
	const verdict = asString(entry.verdict)?.toUpperCase();
	return (verdict === "HIGH" || verdict === "CRITICAL") && asString(entry.entry_id) !== undefined;
}

/**
 * Return at most one current reportable analyzer result per skill. Generation
 * timestamps reconcile audit and cache candidates; append order breaks ties.
 *
 * Deduplication deliberately happens before the risk filter. A newer SAFE
 * result (or a malformed/legacy analyzed result without an entry_id) therefore
 * suppresses an older HIGH/CRITICAL entry instead of exposing stale data.
 */
function latestReportableSkillVerdicts(
	entries: unknown[],
	ttlMs: number,
	now = Date.now(),
): AuditSkillVerdictEntry[] {
	const latestBySkillId = new Map<string, { entry: AuditSkillVerdictEntry; timestamp: number }>();
	for (const entry of entries) {
		if (!isAnalyzedSkillVerdictEntry(entry)) continue;
		const timestamp = Date.parse(asString(entry.timestamp) ?? "");
		if (!isFreshTimestamp(timestamp, ttlMs, now)) continue;
		const normalizedSkillId = entry.skill_id.toLowerCase();
		const current = latestBySkillId.get(normalizedSkillId);
		if (current && timestamp < current.timestamp) continue;
		latestBySkillId.delete(normalizedSkillId);
		latestBySkillId.set(normalizedSkillId, { entry, timestamp });
	}
	return [...latestBySkillId.values()]
		.map(({ entry }) => entry)
		.filter(isReportableSkillVerdictEntry);
}

/**
 * Adapter: presents verdict-cache rows in the audit-entry shape so both stores
 * can go through one merge and one reporting path. Nothing here is read back
 * from the audit log — `signals` is rebuilt from the cached verdict, and
 * entries written before `entryId` was persisted get a derived one.
 */
async function cachedSkillVerdictEntries(
	config: Awaited<ReturnType<typeof loadConfig>>,
	logger: Logger,
): Promise<AuditSkillVerdictEntry[]> {
	const cache = await loadSkillVerdictCacheReadOnly(undefined, skillCacheTtlMs(config), logger);
	return Object.entries(cache.entries).flatMap(([skillId, entry]) => {
		if (!isSkillId(skillId)) return [];
		// Verdict-less rows are the sentinel the upload worker caches for skills it
		// can never analyze (too large / empty). The audit log records those under a
		// non-`analyzed` status, so skipping them keeps both stores consistent
		// instead of letting a sentinel win the newest-generation comparison.
		if (!entry.verdict) return [];
		const normalizedSkillId = skillId.toLowerCase();
		const analyzerVerdict = entry.verdict.toUpperCase();
		const signal = buildSkillCheckSignal(normalizedSkillId, analyzerVerdict, entry.jobId);
		return [
			{
				type: "skill_verdict",
				entry_id: resolveSkillVerdictEntryId(normalizedSkillId, entry),
				timestamp: entry.analyzedAt,
				agent_runtime: entry.sources?.[0]?.agentRuntime,
				skill_id: normalizedSkillId,
				job_id: entry.jobId,
				status: "analyzed",
				verdict: analyzerVerdict,
				signals: signal ? { skill_checks: [signal] } : undefined,
			},
		];
	});
}

function getConversationId(entry: AuditRuntimeVerdictEntry): string | undefined {
	return asString(entry.conversation_id) ?? asString(entry.session_id);
}

function getEntryId(entry: AuditRuntimeVerdictEntry | AuditSkillVerdictEntry): string | undefined {
	return asString(entry.entry_id);
}

function getEntryTimestamp(entry: AuditRuntimeVerdictEntry | AuditSkillVerdictEntry): number {
	const timestamp = Date.parse(asString(entry.timestamp) ?? "");
	return Number.isFinite(timestamp) ? timestamp : 0;
}

function asHookType(value: unknown): HookType | undefined {
	const s = asString(value);
	if (
		s === "PreToolUse" ||
		s === "PostToolUse" ||
		s === "SessionStart" ||
		s === "GatewayStart" ||
		s === "BeforeAgentStart" ||
		s === "MessagesTransform"
	) {
		return s;
	}
	return undefined;
}

async function postMultipart(
	endpoint: string,
	payload: unknown,
	timeoutSeconds: number,
): Promise<{ ok: boolean; status: number; bodyText: string }> {
	const timeoutMs = Math.max(1, Math.floor(timeoutSeconds * 1000));
	const form = new FormData();
	form.append("type", "fp");
	form.append("metadata", JSON.stringify(payload));
	const res = await fetch(endpoint, {
		method: "POST",
		body: form,
		signal: AbortSignal.timeout(timeoutMs),
	});
	const bodyText = await res.text().catch(() => "");
	return { ok: res.ok, status: res.status, bodyText };
}

const MAX_AUDIT_SCAN_ENTRIES = 5000;

const ListInputSchema = z.object({
	conversation_id: z
		.string()
		.optional()
		.describe("Conversation id to filter audit entries; if omitted, uses the most recent one."),
	limit: z
		.number()
		.int()
		.min(1)
		.max(MAX_AUDIT_SCAN_ENTRIES)
		.optional()
		.describe("Max merged entries to return."),
});

const MAX_IMPLICIT_ENTRIES = 3;
const MAX_EXPLICIT_ENTRIES = 10;

const ReportInputSchema = z.object({
	conversation_id: z
		.string()
		.optional()
		.describe("Conversation id to filter audit entries; if omitted, uses the most recent one."),
	description: z.string().min(1).describe("Short description of what is a false positive."),
	reasoning: z
		.string()
		.min(1)
		.describe("Reasoning for why this should be treated as a false positive."),
	agent_runtime_version: z
		.string()
		.optional()
		.describe(
			"Optional agent runtime version override (Cursor/VS Code/Claude version). If omitted, the server resolves the host version from SAGE_APP_ROOT (the application root injected by the Sage extension at MCP-server install time, used to read product.json), then falls back to SAGE_AGENT_RUNTIME_VERSION env, then 'unknown'.",
		),
	entry_ids: z
		.array(z.string())
		.max(MAX_EXPLICIT_ENTRIES)
		.optional()
		.describe(
			`REQUIRED in normal use: list of specific audit entry_ids to report as false positives. ALWAYS call sage_list_audit_entries first to inspect the audit log and identify the exact deny/ask verdict the user considers a false positive, then pass its entry_id here. Up to ${MAX_EXPLICIT_ENTRIES} entry_ids may be provided per call. Omitting this parameter is a fallback that submits up to ${MAX_IMPLICIT_ENTRIES} most recent deny/ask entries for the conversation, which may include irrelevant verdicts and should only be used when entry_id discovery is impossible.`,
		),
	dry_run: z.boolean().optional().describe("If true, do not POST; just show the payload."),
});

/**
 * Parse the runtime detection signals off a stored entry.
 *
 * `skill_checks` is absent by design, not by oversight: a skill signal is
 * rebuilt from the authoritative verdict at the call sites, so parsing the
 * stored one here would put unvalidated text back into the report. The name
 * says "runtime" to keep that boundary visible.
 */
function parseRuntimeAuditSignals(
	raw: unknown,
	options: { includePiContentSnippet?: boolean } = {},
): {
	heuristics?: { detection_name?: string; rule_id: string; rule_version?: number }[];
	url_checks?: { detection_name: string; url: string }[];
	file_checks?: { detection_name: string; file_sha256: string }[];
	package_checks?: {
		detection_name: string;
		package_name: string;
		package_version?: string;
		package_registry: string;
	}[];
	pi_checks?: {
		detection_name?: string;
		risk: number;
		model_id: string;
		content_name: string;
		content_snippet?: string;
	}[];
	amsi_checks?: {
		detection_name: string;
		content_name: string;
		content_snippet?: string;
		amsi_result: number;
	}[];
} {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
	const includePiContentSnippet = options.includePiContentSnippet ?? true;
	const obj = raw as Record<string, unknown>;

	const heuristicsRaw = obj.heuristics;
	const urlChecksRaw = obj.url_checks;
	const fileChecksRaw = obj.file_checks;
	const packageChecksRaw = obj.package_checks;
	const piChecksRaw = obj.pi_checks;
	const amsiChecksRaw = obj.amsi_checks;

	const heuristics = Array.isArray(heuristicsRaw)
		? heuristicsRaw
				.map((h) => {
					if (!h || typeof h !== "object" || Array.isArray(h)) return null;
					const rec = h as Record<string, unknown>;
					const detection_name = asString(rec.detection_name);
					const rule_id = asString(rec.rule_id);
					const rule_version =
						typeof rec.rule_version === "number" ? Math.trunc(rec.rule_version) : undefined;
					if (!rule_id) return null;
					return {
						...(detection_name ? { detection_name } : {}),
						rule_id,
						rule_version,
					};
				})
				.filter(Boolean)
		: undefined;

	const url_checks = Array.isArray(urlChecksRaw)
		? urlChecksRaw
				.map((u) => {
					if (!u || typeof u !== "object" || Array.isArray(u)) return null;
					const rec = u as Record<string, unknown>;
					const detection_name = asString(rec.detection_name);
					const url = asString(rec.url);
					if (!detection_name || !url) return null;
					return { detection_name, url };
				})
				.filter(Boolean)
		: undefined;

	const file_checks = Array.isArray(fileChecksRaw)
		? fileChecksRaw
				.map((f) => {
					if (!f || typeof f !== "object" || Array.isArray(f)) return null;
					const rec = f as Record<string, unknown>;
					const detection_name = asString(rec.detection_name);
					const file_sha256 = asString(rec.file_sha256);
					if (!detection_name || !file_sha256) return null;
					return { detection_name, file_sha256 };
				})
				.filter(Boolean)
		: undefined;

	const package_checks = Array.isArray(packageChecksRaw)
		? packageChecksRaw
				.map((p) => {
					if (!p || typeof p !== "object" || Array.isArray(p)) return null;
					const rec = p as Record<string, unknown>;
					const detection_name = asString(rec.detection_name);
					const package_name = asString(rec.package_name);
					const package_version = asString(rec.package_version);
					const package_registry = asString(rec.package_registry);
					if (!detection_name || !package_name || !package_registry) return null;
					return { detection_name, package_name, package_version, package_registry };
				})
				.filter(Boolean)
		: undefined;

	const pi_checks = Array.isArray(piChecksRaw)
		? piChecksRaw
				.map((m) => {
					if (!m || typeof m !== "object" || Array.isArray(m)) return null;
					const rec = m as Record<string, unknown>;
					const detection_name = asString(rec.detection_name);
					const risk = typeof rec.risk === "number" ? rec.risk : undefined;
					const model_id = asString(rec.model_id);
					const content_name = asString(rec.content_name);
					const content_snippet = asString(rec.content_snippet);
					if (risk === undefined || !model_id || !content_name) return null;
					return {
						...(detection_name ? { detection_name } : {}),
						risk,
						model_id,
						content_name,
						...(content_snippet && includePiContentSnippet ? { content_snippet } : {}),
					};
				})
				.filter(Boolean)
		: undefined;

	// AMSI signals carry a reporting `detection_name` (the Win32 AMSI API only
	// returns a numeric threat level, so `evaluator.ts:buildAmsiSignal` derives
	// the canonical label and appends `sgam:<AMSI rule name>:<hex result>|sage`).
	// Forwarding this entry preserves the full name in the FP payload so the
	// backend can triage AMSI-driven denies; otherwise the only AMSI evidence
	// available downstream would be the free-text reasons string.
	const amsi_checks = Array.isArray(amsiChecksRaw)
		? amsiChecksRaw
				.map((a) => {
					if (!a || typeof a !== "object" || Array.isArray(a)) return null;
					const rec = a as Record<string, unknown>;
					const detection_name = asString(rec.detection_name);
					const content_name = asString(rec.content_name);
					const content_snippet = asString(rec.content_snippet);
					const amsi_result =
						typeof rec.amsi_result === "number" ? Math.trunc(rec.amsi_result) : undefined;
					if (!detection_name || !content_name || amsi_result === undefined) return null;
					return {
						detection_name,
						content_name,
						amsi_result,
						...(content_snippet ? { content_snippet } : {}),
					};
				})
				.filter(Boolean)
		: undefined;

	return {
		heuristics:
			heuristics && heuristics.length > 0
				? (heuristics as {
						detection_name?: string;
						rule_id: string;
						rule_version?: number;
					}[])
				: undefined,
		url_checks:
			url_checks && url_checks.length > 0
				? (url_checks as { detection_name: string; url: string }[])
				: undefined,
		file_checks:
			file_checks && file_checks.length > 0
				? (file_checks as { detection_name: string; file_sha256: string }[])
				: undefined,
		package_checks:
			package_checks && package_checks.length > 0
				? (package_checks as {
						detection_name: string;
						package_name: string;
						package_version?: string;
						package_registry: string;
					}[])
				: undefined,
		pi_checks:
			pi_checks && pi_checks.length > 0
				? (pi_checks as {
						detection_name?: string;
						risk: number;
						model_id: string;
						content_name: string;
						content_snippet?: string;
					}[])
				: undefined,
		amsi_checks:
			amsi_checks && amsi_checks.length > 0
				? (amsi_checks as {
						detection_name: string;
						content_name: string;
						content_snippet?: string;
						amsi_result: number;
					}[])
				: undefined,
	};
}

export function registerFalsePositiveTools(
	server: McpServer,
	opts: { logger: Logger; versionApp: string; branding?: Branding },
): void {
	const logger = opts.logger;
	const versionApp = opts.versionApp;
	const branding = opts.branding ?? defaultBranding;

	server.registerTool(
		"sage_list_audit_entries",
		{
			title: `${branding.name}: List Audit Entries`,
			description: `List recent ${branding.name} runtime and Skill Analyzer audit entries. Runtime entries are optionally scoped to a conversation id; skill entries are global because analysis can finish outside the originating conversation. Useful for selecting entry_ids to report as false positives.`,
			inputSchema: ListInputSchema,
		},
		async ({ conversation_id, limit }) => {
			const complete = (result: string, data: Record<string, unknown> = {}): void => {
				logger.debug("MCP tool completed", {
					toolName: "sage_list_audit_entries",
					result,
					conversationId: conversation_id,
					...data,
				});
			};
			logger.debug("MCP tool started", {
				toolName: "sage_list_audit_entries",
				conversationId: conversation_id,
				limit,
			});
			try {
				const config = await loadConfig(undefined, logger);
				const outputLimit = limit ?? 500;
				const entries = await getRecentEntries(config.logging, MAX_AUDIT_SCAN_ENTRIES);
				const runtime = entries.filter(isRuntimeVerdictEntry);
				const cachedSkills = await cachedSkillVerdictEntries(config, logger);
				const skills = latestReportableSkillVerdicts(
					[...entries, ...cachedSkills],
					skillCacheTtlMs(config),
				);

				const inferredConversationId =
					conversation_id ??
					getConversationId(
						runtime
							.slice()
							.reverse()
							.find((e) => !!getConversationId(e)) ?? {},
					);

				if (!inferredConversationId && skills.length === 0) {
					complete("skipped", { skippedReason: "no_reportable_entries", entriesReturned: 0 });
					return textResult("No reportable runtime or skill verdict entries found.", true);
				}

				const filteredRuntime = inferredConversationId
					? runtime.filter((e) => getConversationId(e) === inferredConversationId)
					: [];
				const selected: Array<AuditRuntimeVerdictEntry | AuditSkillVerdictEntry> = [
					...filteredRuntime,
					...skills,
				]
					.sort((a, b) => getEntryTimestamp(a) - getEntryTimestamp(b))
					.slice(-outputLimit);
				const out = selected.map((entry) => {
					if (isReportableSkillVerdictEntry(entry)) {
						const skillId = entry.skill_id;
						const analyzerVerdict = asString(entry.verdict)?.toUpperCase() ?? "";
						const signal = buildSkillCheckSignal(skillId, analyzerVerdict, asString(entry.job_id));
						return {
							type: "skill_verdict",
							entry_id: getEntryId(entry),
							timestamp: asString(entry.timestamp),
							agent_runtime: asString(entry.agent_runtime),
							skill_id: skillId.toLowerCase(),
							job_id: asString(entry.job_id),
							status: asString(entry.status),
							analyzer_verdict: analyzerVerdict,
							signals: signal ? { skill_checks: [signal] } : {},
						};
					}
					const runtimeEntry = entry as AuditRuntimeVerdictEntry;
					return {
						type: "runtime_verdict",
						entry_id: getEntryId(runtimeEntry),
						timestamp: asString(runtimeEntry.timestamp),
						conversation_id: inferredConversationId,
						agent_runtime: asString(runtimeEntry.agent_runtime),
						tool_name: asString(runtimeEntry.tool_name),
						tool_input_summary: asString(runtimeEntry.tool_input_summary),
						verdict: asString(runtimeEntry.verdict),
						severity: asString(runtimeEntry.severity),
						source: asString(runtimeEntry.source),
						user_override: runtimeEntry.user_override,
						// PI snippets are untrusted fetched content. Exclude their raw
						// text from this model-visible response.
						signals: parseRuntimeAuditSignals(runtimeEntry.signals, {
							includePiContentSnippet: false,
						}),
						content: readContent(runtimeEntry),
					};
				});

				complete("completed", {
					conversationId: inferredConversationId,
					entriesReturned: out.length,
				});
				return textResult(
					JSON.stringify({ conversation_id: inferredConversationId, entries: out }, null, 2),
				);
			} catch (e) {
				logger.warn("MCP tool failed", {
					toolName: "sage_list_audit_entries",
					error: String(e),
				});
				complete("failed", { error: String(e) });
				return textResult(`Failed to read audit log: ${e}`, true);
			}
		},
	);

	server.registerTool(
		"sage_report_false_positive",
		{
			title: `${branding.name}: Report False Positive`,
			description:
				`Report ${branding.name} runtime or Skill Analyzer audit entries as false positives to the backend. Runtime entries are scoped to the current conversation; skill entries require explicit entry_ids.\n\n` +
				`USAGE — IMPORTANT:\n` +
				`1. ALWAYS call \`sage_list_audit_entries\` FIRST to inspect the audit log and locate the specific runtime or skill verdict the user considers a false positive.\n` +
				`2. ALWAYS pass the \`entry_ids\` parameter with just the relevant entry id(s); it is required for skill verdicts. Up to ${MAX_EXPLICIT_ENTRIES} entry_ids may be reported per call.\n` +
				`3. Only when entry_id discovery is impossible should \`entry_ids\` be omitted; in that fallback at most ${MAX_IMPLICIT_ENTRIES} most recent deny/ask entries for the conversation are submitted, which may include irrelevant verdicts and floods the backend with noise.`,
			inputSchema: ReportInputSchema,
		},
		async ({
			conversation_id,
			description,
			reasoning,
			agent_runtime_version,
			entry_ids,
			dry_run,
		}) => {
			const complete = (result: string, data: Record<string, unknown> = {}): void => {
				logger.debug("MCP tool completed", {
					toolName: "sage_report_false_positive",
					result,
					conversationId: conversation_id,
					entryIdsCount: entry_ids?.length ?? 0,
					dryRun: dry_run === true,
					...data,
				});
			};
			logger.debug("MCP tool started", {
				toolName: "sage_report_false_positive",
				conversationId: conversation_id,
				entryIdsCount: entry_ids?.length ?? 0,
				dryRun: dry_run === true,
			});
			try {
				const config = await loadConfig(undefined, logger);
				const endpoint = resolveEndpoint("/v2/fp-report");
				const timeoutSeconds = Number(process.env.SAGE_FALSE_POSITIVE_TIMEOUT_SECONDS) || 5;

				// Match the list tool's maximum so every entry it can expose can
				// subsequently be resolved by explicit entry_id.
				const entries = await getRecentEntries(config.logging, MAX_AUDIT_SCAN_ENTRIES);
				const runtime = entries.filter(isRuntimeVerdictEntry);
				const cachedSkills = await cachedSkillVerdictEntries(config, logger);
				const skills = latestReportableSkillVerdicts(
					[...entries, ...cachedSkills],
					skillCacheTtlMs(config),
				);
				const inferredConversationId =
					conversation_id ??
					getConversationId(
						runtime
							.slice()
							.reverse()
							.find((e) => !!getConversationId(e)) ?? {},
					);

				let filtered: Array<AuditRuntimeVerdictEntry | AuditSkillVerdictEntry>;
				if (entry_ids && entry_ids.length > 0) {
					if (entry_ids.length > MAX_EXPLICIT_ENTRIES) {
						complete("failed_validation", {
							conversationId: inferredConversationId,
							entryIdsCount: entry_ids.length,
							maxEntries: MAX_EXPLICIT_ENTRIES,
						});
						return textResult(
							`Too many entry_ids (${entry_ids.length}). Provide at most ${MAX_EXPLICIT_ENTRIES} specific entry_ids per report call.`,
							true,
						);
					}
					const wanted = new Set(entry_ids);
					const scopedRuntime = inferredConversationId
						? runtime.filter((e) => getConversationId(e) === inferredConversationId)
						: [];
					filtered = [...scopedRuntime, ...skills].filter((e) => {
						const id = getEntryId(e);
						return id !== undefined && wanted.has(id);
					});
				} else {
					if (!inferredConversationId) {
						complete("skipped", { skippedReason: "no_runtime_entries", reportsCount: 0 });
						return textResult(
							"No runtime_verdict entries found. Skill verdicts must be reported with explicit entry_ids.",
							true,
						);
					}
					filtered = runtime.filter((e) => {
						if (getConversationId(e) !== inferredConversationId) return false;
						const v = asString(e.verdict);
						return v === "deny" || v === "ask";
					});
					if (filtered.length > MAX_IMPLICIT_ENTRIES) {
						filtered = filtered.slice(-MAX_IMPLICIT_ENTRIES);
					}
				}

				if (filtered.length === 0) {
					if (entry_ids && entry_ids.length > 0) {
						complete("skipped", {
							conversationId: inferredConversationId,
							skippedReason: "no_matching_entry_ids",
							reportsCount: 0,
						});
						return textResult(
							"No matching reportable audit entries found for the provided entry_ids. Run sage_list_audit_entries first.",
							true,
						);
					}
					complete("skipped", {
						conversationId: inferredConversationId,
						skippedReason: "no_reportable_entries",
						reportsCount: 0,
					});
					return textResult(
						"No runtime_verdict deny/ask entries found for this conversation to report.",
						true,
					);
				}

				const iid = await getInstallationId().catch(() => undefined);
				if (!iid) {
					logger.warn("MCP tool could not retrieve installation id", {
						toolName: "sage_report_false_positive",
					});
					complete("failed", {
						conversationId: inferredConversationId,
						error: "missing_installation_id",
					});
					return textResult(
						`Failed to retrieve installation id; FP reporting requires a working ${branding.name} install.`,
						true,
					);
				}
				const runtimeVersion =
					agent_runtime_version ??
					HOST_AGENT_RUNTIME_VERSION ??
					process.env.SAGE_AGENT_RUNTIME_VERSION ??
					"unknown";

				const comment = `${description}\n\n${reasoning}`;

				// Optional extended-info enrichment. Loaded once per FP-tool invocation
				// and applied to every report payload. Fail-open: any error inside the
				// loader yields `null`, leaving payloads unchanged.
				const extendedInfo = await loadExtendedInfo(undefined, logger).catch(() => null);

				const reports = filtered
					.map((e) => {
						const isSkill = isReportableSkillVerdictEntry(e);
						const runtimeEntry = isSkill ? undefined : (e as AuditRuntimeVerdictEntry);
						const entry_id = getEntryId(e);
						const timestamp = asString(e.timestamp) ?? new Date().toISOString();
						const agent_runtime = asString(e.agent_runtime) ?? "unknown";
						const analyzerVerdict = isSkill ? asString(e.verdict)?.toUpperCase() : undefined;
						const tool_type = isSkill ? "Skill" : (asString(runtimeEntry?.tool_name) ?? "Unknown");
						const verdict = isSkill
							? analyzerVerdict === "CRITICAL"
								? "deny"
								: "ask"
							: (asString(e.verdict) ?? "deny");
						const wasAllowed =
							!isSkill && (verdict === "allow" || runtimeEntry?.user_override === true);
						const user_action = wasAllowed ? "allowed" : "blocked";
						const hook_type = isSkill
							? "SessionStart"
							: (asHookType(runtimeEntry?.hook_type) ?? "PreToolUse");

						// Dry-run output is returned directly to the model. Do not expose
						// untrusted PI text there; preserve it only for backend reports.
						const signals = parseRuntimeAuditSignals(e.signals, {
							includePiContentSnippet: !dry_run,
						});
						const content = runtimeEntry ? readContent(runtimeEntry) : {};
						const contentSnippet = runtimeEntry ? readContentSnippet(runtimeEntry) : undefined;

						const bestEffortSignals: Record<string, unknown> = {};
						if (signals.heuristics) bestEffortSignals.heuristics = signals.heuristics;
						if (signals.url_checks) bestEffortSignals.url_checks = signals.url_checks;
						if (signals.file_checks) bestEffortSignals.file_checks = signals.file_checks;
						if (signals.package_checks) bestEffortSignals.package_checks = signals.package_checks;
						if (signals.pi_checks) bestEffortSignals.pi_checks = signals.pi_checks;
						if (signals.amsi_checks) bestEffortSignals.amsi_checks = signals.amsi_checks;
						// Always rebuilt from the authoritative verdict, never copied from
						// the stored signal — a runtime entry carrying `skill_checks` is
						// not something Sage writes, so it is dropped rather than trusted.
						if (isSkill) {
							const signal = analyzerVerdict
								? buildSkillCheckSignal(e.skill_id, analyzerVerdict, asString(e.job_id))
								: undefined;
							if (signal) bestEffortSignals.skill_checks = [signal];
						}

						const baseReportPayload = {
							...buildSageProxyEnvelope({
								iid,
								versionApp,
								agentRuntime: agent_runtime,
								agentRuntimeVersion: runtimeVersion,
								config,
							}),
							block_event: {
								hook_type,
								tool_type,
								verdict,
								user_action,
								timestamp,
								...(Object.keys(bestEffortSignals).length > 0
									? { signals: bestEffortSignals }
									: {}),
								...(Object.keys(content).length > 0 ? { content } : {}),
								...(contentSnippet && !dry_run ? { content_snippet: contentSnippet } : {}),
							},
							comment,
							event_id: entry_id ?? randomUUID(),
						};

						const reportPayload = mergeExtendedInfo(
							baseReportPayload as unknown as Record<string, unknown>,
							extendedInfo,
						);

						return { entry_id, payload: reportPayload };
					})
					.filter((r) => r.payload);

				if (dry_run) {
					complete("completed", {
						conversationId: inferredConversationId,
						reportsCount: reports.length,
					});
					return textResult(JSON.stringify({ endpoint, reports }, null, 2));
				}

				const results: {
					entry_id?: string;
					ok: boolean;
					status: number;
					bodyText: string;
					report_id?: string;
				}[] = [];
				for (const report of reports) {
					const res = await postMultipart(endpoint, report.payload, timeoutSeconds);
					let report_id: string | undefined;
					try {
						const parsed = JSON.parse(res.bodyText) as Record<string, unknown>;
						if (typeof parsed.report_id === "string") {
							report_id = parsed.report_id;
						}
					} catch {
						// ignore
					}
					results.push({
						entry_id: report.entry_id,
						ok: res.ok,
						status: res.status,
						bodyText: res.bodyText,
						report_id,
					});
				}

				const failed = results.filter((r) => !r.ok);
				if (failed.length > 0) {
					const summary = {
						reported: results.length,
						failed: failed.length,
						failures: failed.slice(0, 5),
					};
					logger.warn("MCP false-positive report submission partially failed", {
						reported: results.length,
						failed: failed.length,
					});
					complete("partial_failure", {
						conversationId: inferredConversationId,
						reported: results.length,
						failed: failed.length,
					});
					return textResult(
						`Some reports failed to submit. Summary:\n${JSON.stringify(summary, null, 2)}`,
						true,
					);
				}

				complete("completed", {
					conversationId: inferredConversationId,
					reported: filtered.length,
				});
				const scope = inferredConversationId
					? ` for conversation_id=${inferredConversationId}`
					: "";
				return textResult(
					`Reported ${filtered.length} audit entr${filtered.length === 1 ? "y" : "ies"}${scope}.`,
				);
			} catch (e) {
				logger.warn("MCP tool failed", {
					toolName: "sage_report_false_positive",
					error: String(e),
				});
				complete("failed", { error: String(e) });
				return textResult(`Failed to report false positive: ${e}`, true);
			}
		},
	);
}
