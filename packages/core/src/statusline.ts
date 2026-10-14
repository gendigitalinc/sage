/**
 * Session status file for detection notifications.
 * Writes per-session status to ~/.sage/statusline-{sessionId}.txt
 * so that status line scripts and extension hosts can display detection counts.
 */

import * as fsPromises from "node:fs/promises";
import { join } from "node:path";
import { defaultBranding } from "./brands.js";
import { resolvePath, SAGE_DIR } from "./config.js";
import { atomicWriteJson, getFileContent } from "./file-utils.js";
import type { SkillVerdictSource } from "./skill-verdict-cache.js";
import type { Branding, Verdict } from "./types.js";

export interface SessionStatus {
	denied: number;
	flagged: number;
	lastCategory: string | null;
	lastReason: string | null;
	updatedAt: string;
	startedAt?: string;
}

/** Skill Analyzer warning displayed on the status line by pollers. */
export interface SkillWarning {
	/** Total number of risky skills (may exceed `names.length` when truncated). */
	count: number;
	/** Risky skill names, newest first; rendered as a comma list, truncated to fit. */
	names: string[];
}

const AGENT_RUNTIME_LABELS: Record<string, string> = {
	"claude-code": "Claude Code",
	cursor: "Cursor",
	vscode: "VS Code",
	openclaw: "OpenClaw",
	opencode: "OpenCode",
	pi: "Pi",
};

/** User-facing label for an agent runtime id; unknown ids pass through. */
export function agentRuntimeLabel(runtime: string): string {
	return AGENT_RUNTIME_LABELS[runtime] ?? runtime;
}

/**
 * The runtime to label a skill warning with, or undefined when no label is
 * needed: a verdict discovered (also) in the current runtime is a local
 * finding, so only purely-foreign verdicts get an origin label.
 */
export function foreignSourceRuntime(
	sources: SkillVerdictSource[] | undefined,
	currentRuntime: string,
): string | undefined {
	if (!sources?.length) return undefined;
	if (sources.some((s) => s.agentRuntime === currentRuntime)) return undefined;
	return sources.find((s) => s.agentRuntime)?.agentRuntime;
}
const STATUS_PREFIX = "statusline-";
const STATUS_SUFFIX = ".txt";

/** Sanitize session ID for safe use in file paths. */
export function sanitizeSessionId(sessionId: string): string {
	return sessionId.replace(/[^a-zA-Z0-9-]/g, "_");
}

function statusFilePath(sessionId: string): string {
	return join(
		resolvePath(SAGE_DIR),
		`${STATUS_PREFIX}${sanitizeSessionId(sessionId)}${STATUS_SUFFIX}`,
	);
}

function emptyStatus(): SessionStatus {
	const now = new Date().toISOString();
	return {
		denied: 0,
		flagged: 0,
		lastCategory: null,
		lastReason: null,
		updatedAt: now,
		startedAt: now,
	};
}

async function readStatus(sessionId: string): Promise<SessionStatus> {
	try {
		const raw = await getFileContent(statusFilePath(sessionId), "utf-8");
		return JSON.parse(raw) as SessionStatus;
	} catch {
		return emptyStatus();
	}
}

/** Update the session status file after a non-allow verdict. */
export async function updateSessionStatus(sessionId: string, verdict: Verdict): Promise<void> {
	const status = await readStatus(sessionId);

	if (verdict.decision === "deny") {
		status.denied++;
	} else if (verdict.decision === "ask") {
		status.flagged++;
	}

	status.lastCategory = verdict.category;
	status.lastReason = verdict.reasons[0] ?? null;
	status.updatedAt = new Date().toISOString();

	await atomicWriteJson(statusFilePath(sessionId), status);
}

/** Initialize a clean status file for a new session. */
export async function initSessionStatus(sessionId: string): Promise<void> {
	const path = statusFilePath(sessionId);
	try {
		await fsPromises.access(path);
		// Already exists — don't overwrite
	} catch {
		await atomicWriteJson(path, emptyStatus());
	}
}

const SKILL_NAMES_MAX_CHARS = 50;

/**
 * Join skill names with ", ", stopping once the running length would exceed
 * `maxChars`; a truncated list gets a trailing ",..." marker. The first name is
 * always kept even if it alone exceeds the limit, so the segment is never empty
 * for a non-empty input.
 */
function joinNamesWithLimit(names: string[], maxChars: number): string {
	const kept: string[] = [];
	let length = 0;
	for (const name of names) {
		const addition = kept.length === 0 ? name : `, ${name}`;
		if (kept.length > 0 && length + addition.length > maxChars) {
			return `${kept.join(", ")},...`;
		}
		kept.push(name);
		length += addition.length;
	}
	return kept.join(", ");
}

/**
 * Render a skill warning segment as `N malicious skill(s) (Name1, Name2,...)`.
 * Kept to a single line: the name list is truncated with a ",..." marker once
 * it would exceed {@link SKILL_NAMES_MAX_CHARS}.
 */
function formatSkillWarning(warning: SkillWarning): string {
	const noun = warning.count === 1 ? "malicious skill" : "malicious skills";
	const names = joinNamesWithLimit(warning.names, SKILL_NAMES_MAX_CHARS);
	if (!names) {
		return `⚠️ ${warning.count} ${noun}`;
	}
	return `⚠️ ${warning.count} ${noun} (${names})`;
}

/** Format the status line content for display. */
export function formatStatusLine(
	denied: number,
	flagged: number,
	lastReason?: string | null,
	lastCategory?: string | null,
	branding: Branding = defaultBranding,
	skillWarning?: SkillWarning,
): string {
	const name = branding.name;
	let line: string;

	if (skillWarning && skillWarning.count > 0) {
		line = `🛡️ ${name}:`;
		line += ` ${formatSkillWarning(skillWarning)}`;
		return line;
	}

	if (denied > 0 || flagged > 0) {
		const parts: string[] = [];
		if (denied > 0) parts.push(`${denied} blocked`);
		if (flagged > 0) parts.push(`${flagged} flagged`);
		const detail = lastReason ? ` — ${lastReason}${lastCategory ? ` (${lastCategory})` : ""}` : "";
		line = `🛡️ ${name}: ${parts.join(", ")}${detail}`;
	} else {
		line = `🛡️ ${name}: ✅`;
	}

	return line;
}

/** Read current session status. Returns null if file doesn't exist. */
export async function readSessionStatus(sessionId: string): Promise<SessionStatus | null> {
	try {
		const raw = await getFileContent(statusFilePath(sessionId), "utf-8");
		return JSON.parse(raw) as SessionStatus;
	} catch {
		return null;
	}
}

/** Remove stale statusline files older than maxAgeMs. Default: 24 hours. */
export async function pruneSessionStatusFiles(maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
	const dir = resolvePath(SAGE_DIR);
	try {
		const entries = await fsPromises.readdir(dir);
		const now = Date.now();
		for (const entry of entries) {
			if (!entry.startsWith(STATUS_PREFIX) || !entry.endsWith(STATUS_SUFFIX)) continue;
			try {
				const fullPath = join(dir, entry);
				const s = await fsPromises.stat(fullPath);
				if (now - s.mtimeMs > maxAgeMs) {
					await fsPromises.unlink(fullPath);
				}
			} catch {
				// Best-effort
			}
		}
	} catch {
		// Dir doesn't exist or unreadable
	}
}
