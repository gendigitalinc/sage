import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import {
	buildSageProxyEnvelope,
	getInstallationId,
	getRecentEntries,
	type HookType,
	type Logger,
	loadConfig,
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
	hook_type?: unknown;
};

function asString(v: unknown): string | undefined {
	return typeof v === "string" ? v : undefined;
}

function asStringArray(v: unknown): string[] | undefined {
	if (!Array.isArray(v)) return undefined;
	const out: string[] = [];
	for (const item of v) {
		if (typeof item === "string") out.push(item);
	}
	return out;
}

function scrubHomePath(value: string): string {
	const home = homedir();
	if (!home) return value;
	const normalizedHome = home.replace(/\\/g, "/").replace(/\/+$/, "");
	const normalizedValue = value.replace(/\\/g, "/");
	if (!normalizedHome) return value;
	if (normalizedValue === normalizedHome) return "~";
	if (normalizedValue.startsWith(`${normalizedHome}/`)) {
		return `~/${normalizedValue.slice(normalizedHome.length + 1)}`;
	}
	return value;
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
			"Optional agent runtime version override (Cursor/VS Code/Claude version). If omitted, uses env SAGE_AGENT_RUNTIME_VERSION or 'unknown'.",
		),
	entry_ids: z.array(z.string()).optional().describe("Optional list of audit entry ids to report."),
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
} {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
	const obj = raw as Record<string, unknown>;

	const heuristicsRaw = obj.heuristics;
	const urlChecksRaw = obj.url_checks;
	const fileChecksRaw = obj.file_checks;
	const packageChecksRaw = obj.package_checks;

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
	};
}

export function registerFalsePositiveTools(
	server: McpServer,
	opts: { logger: Logger; versionApp: string },
): void {
	const logger = opts.logger;
	const versionApp = opts.versionApp;

	server.registerTool(
		"sage_list_audit_entries",
		{
			title: "Sage: List Audit Entries",
			description:
				"List recent Sage audit log entries, optionally scoped to a conversation id. Useful for selecting entry_ids to report as false positives.",
			inputSchema: ListInputSchema,
		},
		async ({ conversation_id, limit }) => {
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
				}));

				return textResult(
					JSON.stringify({ conversation_id: inferredConversationId, entries: out }, null, 2),
				);
			} catch (e) {
				return textResult(`Failed to read audit log: ${e}`, true);
			}
		},
	);

	server.registerTool(
		"sage_report_false_positive",
		{
			title: "Sage: Report False Positive",
			description:
				"Report Sage audit log entries as false positives to the backend, scoped to the current conversation.",
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
					return textResult("No runtime_verdict entries found in the audit log.", true);
				}

				let filtered = runtime.filter((e) => getConversationId(e) === inferredConversationId);
				if (entry_ids && entry_ids.length > 0) {
					const wanted = new Set(entry_ids);
					filtered = filtered.filter((e) => {
						const id = getEntryId(e);
						return id ? wanted.has(id) : false;
					});
				}

				if (filtered.length === 0) {
					if (entry_ids && entry_ids.length > 0) {
						return textResult(
							"No matching audit entries found for the provided entry_ids in this conversation. Run sage_list_audit_entries first.",
							true,
						);
					}
					return textResult(
						"No runtime_verdict entries found for this conversation to report.",
						true,
					);
				}

				const iid = await getInstallationId().catch(() => undefined);
				if (!iid) {
					return textResult(
						"Failed to retrieve installation id; FP reporting requires a working Sage install.",
						true,
					);
				}
				const runtimeVersion =
					agent_runtime_version ?? process.env.SAGE_AGENT_RUNTIME_VERSION ?? "unknown";

				const comment = `${description}\n\n${reasoning}`;

				const reports = filtered
					.map((e) => {
						const entry_id = getEntryId(e);
						const timestamp = asString(e.timestamp) ?? new Date().toISOString();
						const agent_runtime = asString(e.agent_runtime) ?? "unknown";
						const tool_type = asString(e.tool_name) ?? "Unknown";
						const verdict = asString(e.verdict) ?? "deny";
						const user_action = e.user_override === true ? "allowed" : "blocked";
						const hook_type = asHookType(e.hook_type) ?? "PreToolUse";

						const artifacts = asStringArray(e.artifacts) ?? [];
						const signals = parseAuditSignals(e.signals);

						const urlFromArtifacts = artifacts.find(
							(a) => typeof a === "string" && /^https?:\/\//i.test(a),
						);
						const commandFromSummary = asString(e.tool_input_summary) ?? "";
						const content: Record<string, unknown> = {};
						if (tool_type === "Bash") {
							content.command = scrubHomePath(commandFromSummary);
						}
						if (
							tool_type === "Write" ||
							tool_type === "Edit" ||
							tool_type === "Read" ||
							tool_type === "Delete"
						) {
							content.file_path = scrubHomePath(commandFromSummary);
						}
						if (tool_type === "WebFetch" && urlFromArtifacts) {
							content.url = urlFromArtifacts;
						}
						if (signals.url_checks && signals.url_checks.length === 1) {
							content.url = signals.url_checks[0]?.url;
						}
						if (signals.package_checks && signals.package_checks.length === 1) {
							const p = signals.package_checks[0];
							content.package_name = p?.package_name;
							content.package_version = p?.package_version;
							content.package_registry = p?.package_registry;
						}

						const bestEffortSignals: Record<string, unknown> = {};
						if (signals.heuristics) bestEffortSignals.heuristics = signals.heuristics;
						if (signals.url_checks) bestEffortSignals.url_checks = signals.url_checks;
						if (signals.file_checks) bestEffortSignals.file_checks = signals.file_checks;
						if (signals.package_checks) bestEffortSignals.package_checks = signals.package_checks;

						const reportPayload = {
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

						return { entry_id, payload: reportPayload };
					})
					.filter((r) => r.payload);

				if (dry_run) {
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
					return textResult(
						`Some reports failed to submit. Summary:\n${JSON.stringify(summary, null, 2)}`,
						true,
					);
				}

				return textResult(
					`Reported ${filtered.length} audit entr${filtered.length === 1 ? "y" : "ies"} for conversation_id=${inferredConversationId}.`,
				);
			} catch (e) {
				return textResult(`Failed to report false positive: ${e}`, true);
			}
		},
	);
}
