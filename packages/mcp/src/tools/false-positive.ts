import { randomUUID } from "node:crypto";
import {
	type Branding,
	buildSageProxyEnvelope,
	defaultBranding,
	getInstallationId,
	getRecentEntries,
	type HookType,
	type Logger,
	loadConfig,
	loadExtendedInfo,
	mergeExtendedInfo,
	readProductJsonVersion,
	resolveEndpoint,
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
	hook_type?: unknown;
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
 * directly with no reconstruction — legacy entries without a `content` field
 * produce an empty object rather than a heuristic rebuild, which is acceptable
 * because audit logs rotate naturally via `max_bytes` / `max_files`.
 */
function readContent(entry: AuditRuntimeVerdictEntry): Record<string, unknown> {
	const raw = entry.content;
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
	return raw as Record<string, unknown>;
}

function isRuntimeVerdictEntry(v: unknown): v is AuditRuntimeVerdictEntry {
	if (!v || typeof v !== "object" || Array.isArray(v)) return false;
	return (v as Record<string, unknown>).type === "runtime_verdict";
}

function getConversationId(entry: AuditRuntimeVerdictEntry): string | undefined {
	return asString(entry.conversation_id) ?? asString(entry.session_id);
}

function getEntryId(entry: AuditRuntimeVerdictEntry): string | undefined {
	return asString(entry.entry_id);
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

const ListInputSchema = z.object({
	conversation_id: z
		.string()
		.optional()
		.describe("Conversation id to filter audit entries; if omitted, uses the most recent one."),
	limit: z.number().int().min(1).max(5000).optional().describe("Max entries to scan and return."),
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
		.optional()
		.describe(
			`REQUIRED in normal use: list of specific audit entry_ids to report as false positives. ALWAYS call sage_list_audit_entries first to inspect the audit log and identify the exact deny/ask verdict the user considers a false positive, then pass its entry_id here. Up to ${MAX_EXPLICIT_ENTRIES} entry_ids may be provided per call. Omitting this parameter is a fallback that submits up to ${MAX_IMPLICIT_ENTRIES} most recent deny/ask entries for the conversation, which may include irrelevant verdicts and should only be used when entry_id discovery is impossible.`,
		),
	dry_run: z.boolean().optional().describe("If true, do not POST; just show the payload."),
});

function parseAuditSignals(raw: unknown): {
	heuristics?: { rule_id: string; rule_version?: number }[];
	url_checks?: { detection_name: string; url: string }[];
	file_checks?: { detection_name: string; file_sha256: string }[];
	package_checks?: {
		detection_name: string;
		package_name: string;
		package_version?: string;
		package_registry: string;
	}[];
	pi_checks?: {
		risk: number;
		model_id: string;
		content_name: string;
	}[];
	amsi_checks?: {
		detection_name: string;
		content_name: string;
		content_snippet?: string;
		amsi_result: number;
	}[];
} {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
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
					const rule_id = asString(rec.rule_id);
					const rule_version =
						typeof rec.rule_version === "number" ? Math.trunc(rec.rule_version) : undefined;
					if (!rule_id) return null;
					return { rule_id, rule_version };
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
					const risk = typeof rec.risk === "number" ? rec.risk : undefined;
					const model_id = asString(rec.model_id);
					const content_name = asString(rec.content_name);
					if (risk === undefined || !model_id || !content_name) return null;
					return { risk, model_id, content_name };
				})
				.filter(Boolean)
		: undefined;

	// AMSI signals carry a synthesized `detection_name` (the Win32 AMSI API only
	// returns a numeric threat level, so `evaluator.ts:buildAmsiSignal` derives
	// the label from `amsi_result`). Forwarding this entry preserves that
	// synthesized name in the FP payload so the backend can triage AMSI-driven
	// denies; otherwise the only AMSI evidence available downstream would be
	// the free-text reasons string.
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
				? (heuristics as { rule_id: string; rule_version?: number }[])
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
				? (pi_checks as { risk: number; model_id: string; content_name: string }[])
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
			description: `List recent ${branding.name} audit log entries, optionally scoped to a conversation id. Useful for selecting entry_ids to report as false positives.`,
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
				const scanLimit = limit ?? 500;
				const entries = await getRecentEntries(config.logging, scanLimit);
				const runtime = entries.filter(isRuntimeVerdictEntry);

				const inferredConversationId =
					conversation_id ??
					getConversationId(
						runtime
							.slice()
							.reverse()
							.find((e) => !!getConversationId(e)) ?? {},
					);

				if (!inferredConversationId) {
					complete("skipped", { skippedReason: "no_runtime_entries", entriesReturned: 0 });
					return textResult("No runtime_verdict entries found in the audit log.", true);
				}

				const filtered = runtime.filter((e) => getConversationId(e) === inferredConversationId);
				const out = filtered.map((e) => ({
					entry_id: getEntryId(e),
					timestamp: asString(e.timestamp),
					conversation_id: inferredConversationId,
					agent_runtime: asString(e.agent_runtime),
					tool_name: asString(e.tool_name),
					tool_input_summary: asString(e.tool_input_summary),
					verdict: asString(e.verdict),
					severity: asString(e.severity),
					source: asString(e.source),
					user_override: e.user_override,
					signals: parseAuditSignals(e.signals),
					content: readContent(e),
				}));

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
				`Report ${branding.name} audit log entries as false positives to the backend, scoped to the current conversation.\n\n` +
				`USAGE — IMPORTANT:\n` +
				`1. ALWAYS call \`sage_list_audit_entries\` FIRST to inspect the audit log and locate the specific deny/ask verdict the user considers a false positive.\n` +
				`2. ALWAYS pass the \`entry_ids\` parameter with just the relevant deny/ask entry id(s). Up to ${MAX_EXPLICIT_ENTRIES} entry_ids may be reported per call.\n` +
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

				const scanLimit = 2000;
				const entries = await getRecentEntries(config.logging, scanLimit);
				const runtime = entries.filter(isRuntimeVerdictEntry);
				const inferredConversationId =
					conversation_id ??
					getConversationId(
						runtime
							.slice()
							.reverse()
							.find((e) => !!getConversationId(e)) ?? {},
					);

				if (!inferredConversationId) {
					complete("skipped", { skippedReason: "no_runtime_entries", reportsCount: 0 });
					return textResult("No runtime_verdict entries found in the audit log.", true);
				}

				let filtered = runtime.filter((e) => getConversationId(e) === inferredConversationId);
				if (entry_ids && entry_ids.length > 0) {
					const wanted = new Set(entry_ids);
					filtered = filtered.filter((e) => {
						const id = getEntryId(e);
						return id ? wanted.has(id) : false;
					});
					if (filtered.length > MAX_EXPLICIT_ENTRIES) {
						complete("failed_validation", {
							conversationId: inferredConversationId,
							reportsCount: filtered.length,
							maxEntries: MAX_EXPLICIT_ENTRIES,
						});
						return textResult(
							`Too many entry_ids (${filtered.length}). Provide at most ${MAX_EXPLICIT_ENTRIES} specific entry_ids per report call.`,
							true,
						);
					}
				} else {
					filtered = filtered.filter((e) => {
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
							"No matching audit entries found for the provided entry_ids in this conversation. Run sage_list_audit_entries first.",
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
						const entry_id = getEntryId(e);
						const timestamp = asString(e.timestamp) ?? new Date().toISOString();
						const agent_runtime = asString(e.agent_runtime) ?? "unknown";
						const tool_type = asString(e.tool_name) ?? "Unknown";
						const verdict = asString(e.verdict) ?? "deny";
						const user_action = e.user_override === true ? "allowed" : "blocked";
						const hook_type = asHookType(e.hook_type) ?? "PreToolUse";

						const signals = parseAuditSignals(e.signals);
						const content = readContent(e);

						const bestEffortSignals: Record<string, unknown> = {};
						if (signals.heuristics) bestEffortSignals.heuristics = signals.heuristics;
						if (signals.url_checks) bestEffortSignals.url_checks = signals.url_checks;
						if (signals.file_checks) bestEffortSignals.file_checks = signals.file_checks;
						if (signals.package_checks) bestEffortSignals.package_checks = signals.package_checks;
						if (signals.pi_checks) bestEffortSignals.pi_checks = signals.pi_checks;
						if (signals.amsi_checks) bestEffortSignals.amsi_checks = signals.amsi_checks;

						const baseReportPayload = {
							...buildSageProxyEnvelope({
								iid,
								versionApp,
								agentRuntime: agent_runtime,
								agentRuntimeVersion: runtimeVersion,
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
								content,
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
				return textResult(
					`Reported ${filtered.length} audit entr${filtered.length === 1 ? "y" : "ies"} for conversation_id=${inferredConversationId}.`,
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
