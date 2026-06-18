/**
 * Approval tracker for Sage PostToolUse → MCP approval flow.
 *
 * Per-session files:
 * - pending-approvals-{sessionId}.json: Written by PreToolUse on `ask`, keyed by tool_use_id.
 * - consumed-approvals-{sessionId}.json: Written by PostToolUse after user approves, keyed by artifact hash.
 *
 * Pending entries are pruned after 1 hour. Consumed entries expire after 10 minutes.
 */

import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
	atomicWriteJson,
	getFileContent,
	type Logger,
	nullLogger,
	resolvePath,
	SAGE_DIR,
	sanitizeSessionId,
} from "@gendigital/sage-core";

const PENDING_STALE_MS = 60 * 60 * 1000; // 1 hour
const CONSUMED_TTL_MS = 10 * 60 * 1000; // 10 minutes
const STALE_FILE_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface PendingArtifact {
	value: string;
	type: string;
}

export interface PendingApproval {
	threatId: string;
	threatTitle: string;
	artifacts: PendingArtifact[];
	createdAt: string;
}

export interface ConsumedApproval {
	threatId: string;
	threatTitle: string;
	artifact: string;
	artifactType: string;
	approvedAt: string;
	expiresAt: string;
}

type PendingStore = Record<string, PendingApproval>;
type ConsumedStore = Record<string, ConsumedApproval>;

function resolvedSageDir(): string {
	return resolvePath(SAGE_DIR);
}

function pendingPath(sessionId: string): string {
	return join(resolvedSageDir(), `pending-approvals-${sanitizeSessionId(sessionId)}.json`);
}

function consumedPath(sessionId: string): string {
	return join(resolvedSageDir(), `consumed-approvals-${sanitizeSessionId(sessionId)}.json`);
}

async function loadJson<T>(path: string): Promise<T | null> {
	try {
		const raw = await getFileContent(resolvePath(path));
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

async function saveOrDelete(path: string, data: Record<string, unknown>): Promise<void> {
	const resolved = resolvePath(path);
	if (Object.keys(data).length === 0) {
		try {
			await unlink(resolved);
		} catch {
			// File may not exist — that's fine
		}
	} else {
		await atomicWriteJson(resolved, data);
	}
}

function pruneStalePending(store: PendingStore): PendingStore {
	const now = Date.now();
	const result: PendingStore = {};
	for (const [key, entry] of Object.entries(store)) {
		if (now - new Date(entry.createdAt).getTime() < PENDING_STALE_MS) {
			result[key] = entry;
		}
	}
	return result;
}

function pruneExpiredConsumed(store: ConsumedStore): ConsumedStore {
	const now = Date.now();
	const result: ConsumedStore = {};
	for (const [key, entry] of Object.entries(store)) {
		if (new Date(entry.expiresAt).getTime() > now) {
			result[key] = entry;
		}
	}
	return result;
}

/** Stable key for consumed-approvals lookup. */
function consumedKey(artifactType: string, artifact: string): string {
	return `${artifactType}:${artifact}`;
}

export async function addPendingApproval(
	sessionId: string,
	toolUseId: string,
	approval: Omit<PendingApproval, "createdAt">,
	logger: Logger = nullLogger,
): Promise<void> {
	try {
		let store = (await loadJson<PendingStore>(pendingPath(sessionId))) ?? {};
		store = pruneStalePending(store);
		store[toolUseId] = { ...approval, createdAt: new Date().toISOString() };
		await saveOrDelete(pendingPath(sessionId), store);
		logger.debug("Pending approval recorded", {
			sessionId,
			toolUseId,
			threatId: approval.threatId,
			artifactsCount: approval.artifacts.length,
		});
	} catch (e) {
		logger.warn("Failed to write pending approval", { error: String(e) });
	}
}

export async function consumePendingApproval(
	sessionId: string,
	toolUseId: string,
	logger: Logger = nullLogger,
): Promise<PendingApproval | null> {
	try {
		let store = (await loadJson<PendingStore>(pendingPath(sessionId))) ?? {};
		store = pruneStalePending(store);
		const entry = store[toolUseId];
		if (!entry) return null;

		// Remove from pending
		delete store[toolUseId];
		await saveOrDelete(pendingPath(sessionId), store);

		// Write one consumed entry per artifact
		let consumed = (await loadJson<ConsumedStore>(consumedPath(sessionId))) ?? {};
		consumed = pruneExpiredConsumed(consumed);
		const now = new Date();
		for (const art of entry.artifacts) {
			const key = consumedKey(art.type, art.value);
			consumed[key] = {
				threatId: entry.threatId,
				threatTitle: entry.threatTitle,
				artifact: art.value,
				artifactType: art.type,
				approvedAt: now.toISOString(),
				expiresAt: new Date(now.getTime() + CONSUMED_TTL_MS).toISOString(),
			};
		}
		await saveOrDelete(consumedPath(sessionId), consumed);

		logger.debug("Pending approval consumed", {
			sessionId,
			toolUseId,
			threatId: entry.threatId,
			artifactsCount: entry.artifacts.length,
		});
		return entry;
	} catch (e) {
		logger.warn("Failed to consume pending approval", { error: String(e) });
		return null;
	}
}

// --- Stale file cleanup ---

export async function pruneStaleSessionFiles(logger: Logger = nullLogger): Promise<void> {
	try {
		const dir = resolvedSageDir();
		const entries = await readdir(dir);
		const now = Date.now();

		for (const file of entries) {
			if (
				!(file.startsWith("pending-approvals-") || file.startsWith("consumed-approvals-")) ||
				!file.endsWith(".json")
			) {
				continue;
			}

			try {
				const fullPath = join(dir, file);
				const info = await stat(fullPath);
				if (now - info.mtimeMs < STALE_FILE_MS) continue;

				const path = join(dir, file);
				if (file.startsWith("pending-approvals-")) {
					let store = (await loadJson<PendingStore>(path)) ?? {};
					store = pruneStalePending(store);
					await saveOrDelete(path, store);
				} else {
					let store = (await loadJson<ConsumedStore>(path)) ?? {};
					store = pruneExpiredConsumed(store);
					await saveOrDelete(path, store);
				}
			} catch {
				// Best-effort per file
			}
		}
	} catch (e) {
		logger.warn("Failed to prune stale session files", { error: String(e) });
	}
}
