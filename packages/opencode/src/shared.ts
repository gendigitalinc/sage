/**
 * Host-agnostic Sage controller shared by the OpenCode v1 (`server`) and v2
 * (`setup`) entry points: config/branding, the scan orchestration and skill
 * verdict watcher, the tool interception pipeline, the approval lifecycle and
 * the Sage MCP server definition. Adapters only translate host hook shapes.
 */

import { mkdirSync, watchFile } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type AgentRuntime,
	ApprovalStore,
	approveAction,
	type Branding,
	checkAllowlistMigration,
	createOperationalLogger,
	foreignSourceRuntime,
	formatAllowlistMigrationWarning,
	formatConfigurationWarnings,
	formatNoticeById,
	getConfigurationWarnings,
	type Logger,
	loadConfig,
	loadSkillVerdictCache,
	type PendingEntry,
	type PluginFinding,
	type PluginScanResult,
	resolveBranding,
	resolvePath,
} from "@gendigital/sage-core";
import { getBundledDataDirs } from "./bundled-dirs.js";
import { createSessionScanHandler } from "./startup-scan.js";
import { createToolHandlers } from "./tool-handler.js";

/** Stable plugin ID reported to both OpenCode v1 and v2 loaders. */
export const SAGE_PLUGIN_ID = "@gendigital/sage-opencode";

/** Key under which the Sage MCP server is registered in OpenCode's `mcp` config. */
export const SAGE_MCP_SERVER_NAME = "sage";

const APPROVAL_STORE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export type ToastVariant = "info" | "success" | "warning" | "error";
export type ToastFn = (msg: string, variant: ToastVariant, durationMs?: number) => void;

const DEFAULT_TOAST_DURATION_MS = 5000;

// The startup security summary lists every risky skill, so it's shown longer to
// give the user time to read the list before it dismisses.
const STARTUP_SUMMARY_DURATION_MS = 10_000;

// Module-scoped so repeated plugin instantiations (OpenCode may load the
// plugin more than once) share a single watcher and one notified-set, instead
// of each instance attaching its own watcher and toasting the same verdict.
//
// This state (watcher, notified-set, session scans, toast queue/notifier) is
// shared by the v1 and v2 adapters. That assumes one OpenCode host per process:
// a host loads either `server` (v1) or `setup` (v2), never both. If both ever
// ran in one process, the first instance's notifier would serve both and each
// session would be scanned once in total, not once per adapter.
const notifiedSkillVerdicts = new Set<string>();
let skillWatcherAttached = false;

// One scan per session, shared across instances: the entry guards against
// re-running the scan when session events fire repeatedly or on more than one
// plugin instance.
const sessionScanPromises = new Map<string, Promise<void>>();

interface QueuedToast {
	message: string;
	variant: ToastVariant;
	durationMs: number;
}
const toastQueue: QueuedToast[] = [];
let toastPumpRunning = false;
// Bound to the first instance's notifier (see createSageController).
let displayToast: ToastFn | undefined;

async function pumpToasts(): Promise<void> {
	if (toastPumpRunning) return;
	toastPumpRunning = true;
	try {
		while (toastQueue.length > 0) {
			const next = toastQueue[0];
			// No notifier bound yet — leave the item queued; a later enqueue resumes.
			if (!displayToast || !next) break;
			displayToast(next.message, next.variant, next.durationMs);
			toastQueue.shift();
			// Hold the slot for this toast's full duration before showing the next,
			// so a following toast can't replace it early (showToast overwrites).
			await new Promise((resolve) => setTimeout(resolve, next.durationMs));
		}
	} finally {
		toastPumpRunning = false;
	}
}

function enqueueToast(
	message: string,
	variant: ToastVariant,
	durationMs = DEFAULT_TOAST_DURATION_MS,
): void {
	toastQueue.push({ message, variant, durationMs });
	void pumpToasts();
}

// Shared dedup key across the two surfacing paths: the scan-findings popup keys
// on `finding.artifact` (which is `skillId.slice(0, 16)`), and the cache watcher
// keys on the full skillId — so both reduce to this 16-char content-hash prefix
// and `notifiedSkillVerdicts` never double-announces the same skill version.
function shortSkillId(skillId: string): string {
	return skillId.slice(0, 16);
}

interface RiskySkill {
	skillId: string;
	key: string;
	severity: "CRITICAL" | "WARNING";
	summary?: string;
}

/**
 * Read `~/.sage/skill_verdict_cache.json` and return every HIGH/CRITICAL verdict
 * relevant to this runtime — one per cache entry, NOT deduped, since dedup is
 * caller-specific (the popup keys on current content, the toast queue on
 * skillId). HIGH maps to the "WARNING" label. Verdicts sourced only from other
 * agent runtimes are skipped so one host doesn't echo another's finds.
 */
async function collectRiskySkills(agentRuntime: AgentRuntime): Promise<RiskySkill[]> {
	const cache = await loadSkillVerdictCache();
	const out: RiskySkill[] = [];
	for (const [skillId, verdict] of Object.entries(cache.entries)) {
		const risk = (verdict.verdict ?? "").toUpperCase();
		if (risk !== "HIGH" && risk !== "CRITICAL") continue;
		if (foreignSourceRuntime(verdict.sources, agentRuntime)) continue;
		const key =
			verdict.sources?.find((s) => s.containerKey)?.containerKey ||
			verdict.skillName ||
			skillId.slice(0, 16);
		out.push({
			skillId,
			key,
			severity: risk === "CRITICAL" ? "CRITICAL" : "WARNING",
			summary: verdict.summary?.trim(),
		});
	}
	return out;
}

/**
 * Watch `~/.sage/skill_verdict_cache.json` and queue one toast per verdict the
 * upload worker writes mid-session (it writes asynchronously, ~one session after
 * discovery). The serial queue shows them one at a time so two skills finishing
 * together are both seen.
 *
 * Verdicts cached by earlier sessions are *seeded silently* on attach — marked
 * notified without a toast — because the plugin initialises before the TUI is
 * ready to render toasts. Those are surfaced instead by the session-start
 * summary popup (see `surfaceStartupSummary`), which runs after the scan when
 * the TUI is up.
 *
 * Dedup keys on `skillId` (content hash), not the container key, so editing a
 * skill — which yields a new hash under the same key — is treated as a new
 * finding and re-announced rather than silently collapsed into the old one.
 */
function setupSkillFindingsWatcher(logger: Logger, agentRuntime: AgentRuntime): void {
	if (skillWatcherAttached) return;
	const sageDir = resolvePath("~/.sage");

	const seedNotified = async (): Promise<void> => {
		try {
			for (const s of await collectRiskySkills(agentRuntime)) {
				notifiedSkillVerdicts.add(shortSkillId(s.skillId));
			}
		} catch (e) {
			logger.debug("Skill verdict seed failed", { error: String(e) });
		}
	};

	// Mid-session: queue one toast per newly written (not-yet-notified) verdict.
	const announceNew = async (): Promise<void> => {
		try {
			for (const s of await collectRiskySkills(agentRuntime)) {
				const short = shortSkillId(s.skillId);
				if (notifiedSkillVerdicts.has(short)) continue;
				notifiedSkillVerdicts.add(short);
				const detail = s.summary ? `${s.key} — ${s.summary}` : `${s.key} detected`;
				logger.debug("Skill finding toast queued", { key: s.key, severity: s.severity });
				enqueueToast(`${detail} (${s.severity})`, s.severity === "CRITICAL" ? "error" : "warning");
			}
		} catch (e) {
			logger.debug("Skill verdict watcher scan failed", { error: String(e) });
		}
	};

	try {
		mkdirSync(sageDir, { recursive: true });
		void seedNotified();
		// Poll the cache file with watchFile rather than watch() the directory.
		// On Windows, fs.watch aborts the whole process (an uncatchable libuv
		// assertion in fs-event.c) when the watched path is an 8.3 short name
		// (e.g. an os.tmpdir() like C:\Users\FOO~1.BAR\...) or symlinked home.
		// watchFile is stat-based polling — immune to that. A few seconds of
		// latency for mid-session verdicts is fine (matches the statusline poll
		// cadence used elsewhere). Handles a not-yet-existent file (polls until
		// it appears).
		const cacheFile = join(sageDir, "skill_verdict_cache.json");
		const watcher = watchFile(cacheFile, { interval: 3000 }, (curr, prev) => {
			if (curr.mtimeMs !== prev.mtimeMs) void announceNew();
		});
		watcher.unref?.();
		skillWatcherAttached = true;
		logger.debug("Skill findings watcher attached", { cacheFile });
	} catch (e) {
		// ~/.sage/ may be unwritable — no watcher, no notifications (fail-open).
		logger.debug("Skill findings watcher setup failed", { error: String(e) });
	}
}

/** Sage MCP server launch definition (host-neutral; each adapter adds its own flags). */
export function sageMcpServerConfig(): {
	type: "local";
	command: string[];
	environment: Record<string, string>;
} {
	const serverPath = join(dirname(fileURLToPath(import.meta.url)), "mcp-server.cjs");
	return {
		type: "local",
		command: [process.execPath, serverPath],
		environment: { BUN_BE_BUN: "1", SAGE_AGENT_RUNTIME: "opencode" },
	};
}

export interface SageHostOptions {
	/** Project directory used for the plugin/skill scan. */
	directory: string;
	/**
	 * Builds the native toast notifier once branding is resolved. Omitted on
	 * hosts without a notification API (OpenCode v2 server plugins);
	 * notifications then go to the operational log instead.
	 */
	createNotifier?: (branding: Branding) => ToastFn;
	/** Host label for log messages (e.g. "v1", "v2"). */
	host: string;
}

export interface SageController {
	branding: Branding;
	logger: Logger;
	/** Canonical tool interception; throws `SageVerdictBlockError` to block. */
	beforeToolUse: ReturnType<typeof createToolHandlers>["tool.execute.before"];
	/** Run the plugin/skill scan once per session ID. */
	scanSession(sessionID: string): Promise<void>;
	/** `sage_approve` description shared by both hosts. */
	approveToolDescription: string;
	/** `sage_approve` actionId argument description shared by both hosts. */
	approveArgDescription: string;
	/**
	 * Run the `sage_approve` lifecycle. `askUser` shows the host's native
	 * dialog and must throw (or reject) when the user declines; any failure is
	 * treated as a rejection (fail closed) and the pending entry is dropped.
	 */
	resolveApproval(
		actionId: string,
		askUser: (pending: PendingEntry) => Promise<void>,
	): Promise<string>;
}

/**
 * Thrown by an adapter's `askUser` when the native approval dialog could not
 * be shown at all (as opposed to the user declining). The action still stays
 * blocked (fail closed), but the message is returned to the agent so the user
 * learns why no dialog appeared and how to fix it.
 */
export class ApprovalUnavailableError extends Error {
	override readonly name = "ApprovalUnavailableError";
}

/** Human-readable artifact labels for approval dialogs. */
export function approvalPatterns(pending: PendingEntry): string[] {
	return pending.artifacts.map((a) => `[${a.type}] ${a.value}`);
}

export async function createSageController(options: SageHostOptions): Promise<SageController> {
	const config = await loadConfig();
	const operationalLogger = createOperationalLogger(config.operational_logging, "opencode");
	const logger = operationalLogger.forComponent("plugin");
	const toolLogger = operationalLogger.forComponent("tool-handler");
	const scanLogger = operationalLogger.forComponent("startup-scan");
	const branding = resolveBranding(config.brand_key, logger);

	// Hosts without a toast API still surface notifications — in the log.
	const notify: ToastFn =
		options.createNotifier?.(branding) ??
		((msg, variant) => {
			const data = { host: options.host, variant };
			if (variant === "error" || variant === "warning") {
				logger.warn(`${branding.name}: ${msg}`, data);
			} else {
				logger.info(`${branding.name}: ${msg}`, data);
			}
		});
	// Bind the module-scoped skill-toast queue to this (first) instance's notifier.
	displayToast ??= notify;

	const warningMessage = formatConfigurationWarnings(
		await getConfigurationWarnings(undefined, logger),
		branding,
	);
	if (warningMessage) notify(warningMessage, "warning", DEFAULT_TOAST_DURATION_MS);
	const allowlistMigration = await checkAllowlistMigration();
	if (allowlistMigration.needed) {
		notify(
			formatAllowlistMigrationWarning(allowlistMigration.entryTypes, branding),
			"warning",
			8000,
		);
	}
	const { threatsDir, trustedDomainsDir } = getBundledDataDirs();
	const approvalStore = new ApprovalStore();

	// Watch for verdicts the upload worker writes mid-session (queued toasts).
	// Verdicts cached by earlier sessions are surfaced by surfaceStartupSummary.
	setupSkillFindingsWatcher(logger, "opencode");

	// Surface the scan's structured findings after the scan (TUI ready). Findings
	// are install- and content-accurate: the scan hashes current on-disk content
	// and looks up its verdict, so a deleted skill isn't discovered and an edited
	// skill is matched by its new hash — no cache re-derivation needed.
	//
	// Single startup surface: one summary toast listing every risky skill from
	// this scan. Summarized skills are marked notified so the cache watcher does
	// not also announce them per-skill; verdicts that land *after* the scan
	// (worker uploads) are still surfaced individually by the watcher.
	const surfaceStartupSummary = (scanResults: PluginScanResult[]): void => {
		try {
			const skills: Array<{
				key: string;
				severity: "CRITICAL" | "WARNING";
				finding: PluginFinding;
			}> = [];
			const seen = new Set<string>();
			for (const result of scanResults) {
				for (const finding of result.findings) {
					if (finding.threatId !== "SKILL_CHECK") continue;
					if (finding.severity !== "critical" && finding.severity !== "warning") continue;
					if (seen.has(result.plugin.key)) continue;
					seen.add(result.plugin.key);
					skills.push({
						key: result.plugin.key,
						severity: finding.severity === "critical" ? "CRITICAL" : "WARNING",
						finding,
					});
				}
			}
			if (skills.length === 0) return;

			// Mark every summarized skill as notified so the cache watcher doesn't
			// also announce it per-skill. `finding.artifact` is the 16-char short
			// hash — the same key the watcher dedups on. Verdicts that land after
			// this scan (worker uploads) are still surfaced individually.
			for (const s of skills) {
				if (s.finding.artifact) notifiedSkillVerdicts.add(s.finding.artifact);
			}

			// The summary: a single toast listing every risky skill, shown longer.
			const hasCritical = skills.some((s) => s.severity === "CRITICAL");
			const body = skills.map((s) => `${s.key} (${s.severity})`).join("\n");
			enqueueToast(
				`${branding.name} detected ${skills.length} malicious/suspicious skill(s):\n${body}`,
				hasCritical ? "error" : "warning",
				STARTUP_SUMMARY_DURATION_MS,
			);
		} catch (e) {
			logger.debug("Skill summary popup failed", { error: String(e) });
		}
	};

	// Set up the cron job that cleans up the approval store.
	const interval = setInterval(() => {
		approvalStore.cleanup();
	}, APPROVAL_STORE_CLEANUP_INTERVAL_MS);
	interval.unref?.();

	const toolHandlers = createToolHandlers(
		toolLogger,
		approvalStore,
		threatsDir,
		trustedDomainsDir,
		{ showToast: notify },
		branding,
	);

	/**
	 * Run the session scan exactly once per session and cache the promise. The
	 * cached promise is the dedupe guard — a second call (repeated session
	 * events, or another plugin instance) returns the same in-flight/settled
	 * promise instead of re-scanning. The scan's structured findings drive the
	 * summary popup (see `surfaceStartupSummary`).
	 */
	const scanSession = (sessionID: string): Promise<void> => {
		if (!sessionID || sessionID === "unknown") return Promise.resolve();
		const existing = sessionScanPromises.get(sessionID);
		if (existing) return existing;

		const promise = (async () => {
			logger.debug(`${branding.name}: starting session scan`, { sessionID, host: options.host });
			const scanHandler = createSessionScanHandler(
				scanLogger,
				options.directory,
				// After the scan (TUI ready): summary popup from the structured findings.
				surfaceStartupSummary,
				branding,
				// One-time notices (e.g. skill-upload consent) as info toasts.
				(noticeIds) => {
					for (const id of noticeIds) {
						const text = formatNoticeById(id, branding);
						if (text) enqueueToast(text, "info", STARTUP_SUMMARY_DURATION_MS);
					}
				},
			);
			await scanHandler();
		})();
		sessionScanPromises.set(sessionID, promise);
		return promise;
	};

	const resolveApproval: SageController["resolveApproval"] = async (actionId, askUser) => {
		const pending = approvalStore.getPending(actionId);
		if (!pending) {
			return `No pending ${branding.name} approval found for this action ID.`;
		}
		try {
			await askUser(pending);
		} catch (error) {
			logger.debug(`${branding.name}: approval dialog failed`, {
				actionId,
				host: options.host,
				error: String(error),
			});
			approvalStore.deletePending(actionId);
			if (error instanceof ApprovalUnavailableError) {
				logger.warn(`${branding.name}: approval dialog unavailable`, {
					actionId,
					host: options.host,
					error: error.message,
				});
				return `Rejected: the ${branding.name} approval dialog could not be shown (${error.message}). The action stays blocked.`;
			}
			logger.debug("OpenCode approval rejected", { actionId, host: options.host });
			return "Rejected by user.";
		}
		logger.info("OpenCode approval accepted", { actionId, host: options.host });
		return approveAction(approvalStore, actionId, branding);
	};

	return {
		branding,
		logger,
		beforeToolUse: toolHandlers["tool.execute.before"],
		scanSession,
		approveToolDescription: `Review a ${branding.name}-flagged tool call. Shows a native approval dialog to the user. Call this immediately when ${branding.name} flags an action — do NOT ask the user in chat first.`,
		approveArgDescription: `Action ID from ${branding.name} flagged message`,
		resolveApproval,
	};
}
