/**
 * Session-level behavioral baseline tracking and anomaly detection.
 * 
 * Tracks per-session action statistics and compares against rolling baselines
 * to detect patterns invisible at the individual action level:
 * - Volume anomalies (e.g., 10x normal bash command rate)
 * - Domain concentration (e.g., 30 requests to *.attacker.com)
 * - File path radius expansion (progressive access to sensitive directories)
 * - Tool type distribution shifts (unusual ratio of Read/Write/Bash calls)
 *
 * Storage: per-session stat files in ~/.sage/sessions/{sessionId}.json
 * Baselines: computed on-the-fly from completed session files
 */

import { mkdir, readFile, writeFile, readdir, unlink, rename } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { nullLogger, type Logger, type SessionBaselineConfig } from "./types.js";

const DEFAULT_WINDOW_SIZE = 10; // sessions
const DEFAULT_CHECK_INTERVAL = 5; // actions between checks
const DEFAULT_STD_THRESHOLD = 2.0; // standard deviations
const STALE_SESSION_AGE_MS = 3600_000; // 1 hour

export interface SessionStats {
	sessionId: string;
	agentId?: string;
	startedAt: number;
	lastActivity: number;
	actionCounts: Record<string, number>; // tool_type -> count
	domains: Record<string, number>; // domain -> request count
	filePaths: string[]; // unique file paths accessed
	bashCommands: number;
	curlRequests: number;
	fileReads: number;
	fileWrites: number;
}

export interface SessionBaseline {
	mean: number;
	stdDev: number;
	windowSize: number;
}

export interface AnomalyResult {
	type: "volume" | "domain_concentration" | "file_radius" | "tool_distribution";
	description: string;
	severity: "warning" | "critical";
	currentValue: number;
	baseline: SessionBaseline;
	deviation: number; // number of standard deviations from mean
}

function createDefaultConfig(): SessionBaselineConfig {
	return {
		enabled: true,
		window_size: 10,
		check_interval: 5,
		std_threshold: 2.0,
		storage_dir: "~/.sage/sessions",
	};
}

function resolvePath(path: string): string {
	if (path.startsWith("~/")) {
		const home = process.env.HOME || process.env.USERPROFILE || "";
		return resolve(home, path.slice(2));
	}
	return resolve(path);
}

function sessionFilePath(storageDir: string, sessionId: string): string {
	return join(resolvePath(storageDir), `${sessionId}.json`);
}

/**
 * Atomically write a session file (write to temp, rename).
 * Rename is atomic on the same filesystem.
 */
async function atomicWriteSession(
	filePath: string,
	data: SessionStats,
	logger: Logger,
): Promise<void> {
	const tmpPath = `${filePath}.tmp-${process.pid}`;
	try {
		await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
		await rename(tmpPath, filePath);
	} catch (error) {
		// Clean up temp file on failure
		try { await unlink(tmpPath); } catch { /* best effort */ }
		logger.warn("Failed to write session file", { filePath, error });
		throw error;
	}
}

/**
 * Read a completed session stat file.
 */
async function readSessionFile(filePath: string): Promise<SessionStats | null> {
	try {
		const content = await readFile(filePath, "utf-8");
		return JSON.parse(content) as SessionStats;
	} catch {
		return null;
	}
}

/**
 * List all completed session files in the storage directory,
 * filtering to those with activity within the window.
 */
async function listCompletedSessions(
	storageDir: string,
	currentSessionId: string,
): Promise<SessionStats[]> {
	const dir = resolvePath(storageDir);
	let entries: string[];
	try {
		entries = await readdir(dir);
	} catch {
		return [];
	}

	const sessions: SessionStats[] = [];
	for (const entry of entries) {
		if (!entry.endsWith(".json")) continue;
		if (entry.startsWith(`tmp-`) || entry.includes(".tmp-")) continue;
		const sessionId = entry.replace(/\.json$/, "");
		if (sessionId === currentSessionId) continue; // skip current
		const session = await readSessionFile(join(dir, entry));
		if (session) sessions.push(session);
	}

	// Sort by startedAt descending, take window
	sessions.sort((a, b) => b.startedAt - a.startedAt);
	return sessions;
}

function computeMean(values: number[]): number {
	if (values.length === 0) return 0;
	return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function computeStdDev(values: number[], mean: number): number {
	if (values.length < 2) return 0;
	const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
	const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);
	return Math.sqrt(variance);
}

function extractDomain(url: string): string {
	try {
		const parsed = new URL(url);
		return parsed.hostname;
	} catch {
		return url;
	}
}

function getDirectoryDepth(path: string): number {
	return path.split("/").filter((segment) => segment.length > 0).length;
}

/**
 * Compute a SessionBaseline from an array of historical values.
 */
function computeBaseline(values: number[], windowSize: number): SessionBaseline {
	const trimmed = values.slice(0, windowSize);
	const mean = computeMean(trimmed);
	const stdDev = computeStdDev(trimmed, mean);
	return { mean, stdDev, windowSize: trimmed.length };
}

export class SessionBaselineTracker {
	private config: SessionBaselineConfig;
	private logger: Logger;
	private activeSessions: Map<string, SessionStats>;

	constructor(config?: Partial<SessionBaselineConfig>, logger?: Logger) {
		this.config = { ...createDefaultConfig(), ...config };
		this.logger = logger ?? nullLogger;
		this.activeSessions = new Map();
	}

	/**
	 * Clean up stale session files from disk.
	 * Call this once at session start to tidy up .sage/sessions/.
	 */
	async truncateStaleSessionFiles(maxAgeMs: number = STALE_SESSION_AGE_MS): Promise<number> {
		const dir = resolvePath(this.config.storage_dir);
		let entries: string[];
		try {
			entries = await readdir(dir);
		} catch {
			return 0;
		}

		const now = Date.now();
		let deleted = 0;

		for (const entry of entries) {
			if (!entry.endsWith(".json")) continue;
			const filePath = join(dir, entry);
			const session = await readSessionFile(filePath);
			if (session && (now - session.lastActivity) > maxAgeMs) {
				try {
					await unlink(filePath);
					deleted++;
				} catch (error) {
					this.logger.warn("Failed to delete stale session file", { filePath, error });
				}
			}
		}

		return deleted;
	}

	/**
	 * Initialize or retrieve session stats.
	 */
	getOrCreateSession(sessionId: string, agentId?: string): SessionStats {
		if (this.activeSessions.has(sessionId)) {
			const session = this.activeSessions.get(sessionId)!;
			session.lastActivity = Date.now();
			return session;
		}

		const session: SessionStats = {
			sessionId,
			agentId,
			startedAt: Date.now(),
			lastActivity: Date.now(),
			actionCounts: {},
			domains: {},
			filePaths: [],
			bashCommands: 0,
			curlRequests: 0,
			fileReads: 0,
			fileWrites: 0,
		};

		this.activeSessions.set(sessionId, session);
		return session;
	}

	/**
	 * Persist the current session stats to disk (atomic write).
	 */
	async persistSession(sessionId: string): Promise<void> {
		const session = this.activeSessions.get(sessionId);
		if (!session) return;
		const filePath = sessionFilePath(this.config.storage_dir, sessionId);
		await mkdir(dirname(filePath), { recursive: true });
		await atomicWriteSession(filePath, session, this.logger);
	}

	/**
	 * Record an action in the session stats and persist.
	 */
	async recordAction(
		sessionId: string,
		toolName: string,
		toolInput: Record<string, unknown>,
		agentId?: string,
	): Promise<SessionStats> {
		const session = this.getOrCreateSession(sessionId, agentId);

		// Update action counts
		session.actionCounts[toolName] = (session.actionCounts[toolName] || 0) + 1;

		// Track tool-specific metrics
		if (toolName === "Bash") {
			session.bashCommands++;
			const command = String(toolInput.command || "");
			if (command.includes("curl") || command.includes("wget")) {
				session.curlRequests++;
			}
		} else if (toolName === "WebFetch") {
			const url = String(toolInput.url || "");
			if (url) {
				const domain = extractDomain(url);
				session.domains[domain] = (session.domains[domain] || 0) + 1;
			}
		} else if (toolName === "Read") {
			session.fileReads++;
			const filePath = String(toolInput.file_path || "");
			if (filePath && !session.filePaths.includes(filePath)) {
				session.filePaths.push(filePath);
			}
		} else if (toolName === "Write" || toolName === "Edit") {
			session.fileWrites++;
			const filePath = String(toolInput.file_path || "");
			if (filePath && !session.filePaths.includes(filePath)) {
				session.filePaths.push(filePath);
			}
		}

		session.lastActivity = Date.now();

		// Persist to disk (atomic rename)
		await this.persistSession(sessionId);

		return session;
	}

	/**
	 * Check if this action count warrants a baseline check.
	 */
	shouldCheckBaselines(actionCount: number): boolean {
		return actionCount % this.config.check_interval === 0;
	}

	/**
	 * Compute anomalies for the current session against historical baselines.
	 */
	async checkBaselines(
		session: SessionStats,
		agentId?: string,
	): Promise<AnomalyResult[]> {
		if (!this.config.enabled) {
			return [];
		}

		// Load completed sessions (exclude current)
		const historical = await listCompletedSessions(
			this.config.storage_dir,
			session.sessionId,
		);

		if (historical.length === 0) {
			return [];
		}

		const windowSize = this.config.window_size;
		const threshold = this.config.std_threshold;
		const anomalies: AnomalyResult[] = [];

		// Check 1: Volume anomaly (bash commands)
		const bashValues = historical.map((s) => s.bashCommands);
		const bashBaseline = computeBaseline(bashValues, windowSize);
		if (bashBaseline.stdDev > 0 && bashBaseline.windowSize >= 3) {
			const deviation = (session.bashCommands - bashBaseline.mean) / bashBaseline.stdDev;
			if (deviation > threshold) {
				anomalies.push({
					type: "volume",
					description: `Bash command volume ${session.bashCommands} exceeds baseline (${bashBaseline.mean.toFixed(1)} ± ${bashBaseline.stdDev.toFixed(1)}) by ${deviation.toFixed(1)}σ`,
					severity: deviation > 3.0 ? "critical" : "warning",
					currentValue: session.bashCommands,
					baseline: bashBaseline,
					deviation,
				});
			}
		}

		// Check 2: Domain concentration
		const domainMaxValues = historical.map((s) => Math.max(0, ...Object.values(s.domains)));
		const domainBaseline = computeBaseline(domainMaxValues, windowSize);
		const currentMaxDomain = Math.max(0, ...Object.values(session.domains));
		if (domainBaseline.stdDev > 0 && domainBaseline.windowSize >= 3 && currentMaxDomain > 0) {
			const deviation = (currentMaxDomain - domainBaseline.mean) / domainBaseline.stdDev;
			if (deviation > threshold) {
				const topDomain = Object.entries(session.domains)
					.sort((a, b) => b[1] - a[1])[0]?.[0];
				anomalies.push({
					type: "domain_concentration",
					description: `Domain concentration ${currentMaxDomain} requests to ${topDomain || "single domain"} exceeds baseline (${domainBaseline.mean.toFixed(1)} ± ${domainBaseline.stdDev.toFixed(1)}) by ${deviation.toFixed(1)}σ`,
					severity: deviation > 3.0 ? "critical" : "warning",
					currentValue: currentMaxDomain,
					baseline: domainBaseline,
					deviation,
				});
			}
		}

		// Check 3: File path radius expansion
		const depthValues = historical.map((s) =>
			s.filePaths.reduce((max, p) => Math.max(max, getDirectoryDepth(p)), 0),
		);
		const depthBaseline = computeBaseline(depthValues, windowSize);
		const currentMaxDepth = session.filePaths.reduce(
			(max, p) => Math.max(max, getDirectoryDepth(p)),
			0,
		);
		if (depthBaseline.stdDev > 0 && depthBaseline.windowSize >= 3 && currentMaxDepth > 0) {
			const deviation = (currentMaxDepth - depthBaseline.mean) / depthBaseline.stdDev;
			if (deviation > threshold) {
				anomalies.push({
					type: "file_radius",
					description: `File access depth ${currentMaxDepth} exceeds baseline (${depthBaseline.mean.toFixed(1)} ± ${depthBaseline.stdDev.toFixed(1)}) by ${deviation.toFixed(1)}σ`,
					severity: deviation > 3.0 ? "critical" : "warning",
					currentValue: currentMaxDepth,
					baseline: depthBaseline,
					deviation,
				});
			}
		}

		return anomalies;
	}

	/**
	 * Clean up expired sessions from in-memory map (no activity for >1 hour).
	 */
	cleanupExpiredSessions(maxAgeMs = STALE_SESSION_AGE_MS): number {
		const now = Date.now();
		let expired = 0;

		for (const [sessionId, session] of this.activeSessions.entries()) {
			if (now - session.lastActivity > maxAgeMs) {
				this.activeSessions.delete(sessionId);
				expired++;
			}
		}

		return expired;
	}
}

/**
 * Create a session baseline tracker instance.
 */
export function createSessionBaselineTracker(
	config?: Partial<SessionBaselineConfig>,
	logger?: Logger,
): SessionBaselineTracker {
	return new SessionBaselineTracker(config, logger);
}
