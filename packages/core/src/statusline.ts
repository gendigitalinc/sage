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
import type { Branding, Verdict } from "./types.js";

export interface SessionStatus {
	denied: number;
	flagged: number;
	lastCategory: string | null;
	lastReason: string | null;
	updatedAt: string;
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
	return {
		denied: 0,
		flagged: 0,
		lastCategory: null,
		lastReason: null,
		updatedAt: new Date().toISOString(),
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

/** Format the status line content for display. */
export function formatStatusLine(
	denied: number,
	flagged: number,
	lastReason?: string | null,
	lastCategory?: string | null,
	branding: Branding = defaultBranding,
): string {
	const name = branding.name;
	if (denied > 0 || flagged > 0) {
		const parts: string[] = [];
		if (denied > 0) parts.push(`${denied} blocked`);
		if (flagged > 0) parts.push(`${flagged} flagged`);
		const detail = lastReason ? ` — ${lastReason}${lastCategory ? ` (${lastCategory})` : ""}` : "";
		return `🛡️ ${name}: ${parts.join(", ")}${detail}`;
	}
	return `🛡️ ${name}: ✅`;
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
