/**
 * Session-level behavioral baseline tracking and anomaly detection.
 * 
 * Tracks per-session action statistics and compares against rolling baselines
 * to detect patterns invisible at the individual action level:
 * - Volume anomalies (e.g., 10x normal bash command rate)
 * - Domain concentration (e.g., 30 requests to *.attacker.com)
 * - File path radius expansion (progressive access to sensitive directories)
 * - Tool type distribution shifts (unusual ratio of Read/Write/Bash calls)
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { nullLogger, type Logger } from "./types.js";

const DEFAULT_WINDOW_SIZE = 10; // sessions
const DEFAULT_CHECK_INTERVAL = 5; // actions between checks
const DEFAULT_STD_THRESHOLD = 2.0; // standard deviations

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

export interface BaselineStore {
	byAgent: Record<string, {
		actionCounts: Record<string, SessionBaseline>;
		bashCommandCounts: SessionBaseline;
		curlRequestCounts: SessionBaseline;
		domainConcentration: SessionBaseline;
		filePathRadius: SessionBaseline;
	}>;
}

export interface AnomalyResult {
	type: "volume" | "domain_concentration" | "file_radius" | "tool_distribution";
	description: string;
	severity: "warning" | "critical";
	currentValue: number;
	baseline: SessionBaseline;
	deviation: number; // number of standard deviations from mean
}

export interface SessionBaselineConfig {
	enabled: boolean;
	windowSize: number;
	checkInterval: number;
	stdThreshold: number;
	storagePath: string;
}

function createDefaultConfig(): SessionBaselineConfig {
	return {
		enabled: true,
		windowSize: DEFAULT_WINDOW_SIZE,
		checkInterval: DEFAULT_CHECK_INTERVAL,
		stdThreshold: DEFAULT_STD_THRESHOLD,
		storagePath: "~/.sage/session-baselines.json",
	};
}

function resolvePath(path: string): string {
	if (path.startsWith("~/")) {
		const home = process.env.HOME || process.env.USERPROFILE || "";
		return resolve(home, path.slice(2));
	}
	return resolve(path);
}

async function loadBaselines(config: SessionBaselineConfig, logger: Logger): Promise<BaselineStore> {
	const path = resolvePath(config.storagePath);
	try {
		const content = await readFile(path, "utf-8");
		return JSON.parse(content) as BaselineStore;
	} catch {
		return { byAgent: {} };
	}
}

async function saveBaselines(
	config: SessionBaselineConfig,
	baselines: BaselineStore,
	logger: Logger,
): Promise<boolean> {
	const path = resolvePath(config.storagePath);
	try {
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, JSON.stringify(baselines, null, 2), "utf-8");
		return true;
	} catch (error) {
		logger.warn("Failed to save session baselines", { error });
		return false;
	}
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
	 * Record an action in the session stats.
	 */
	recordAction(
		sessionId: string,
		toolName: string,
		toolInput: Record<string, unknown>,
		agentId?: string,
	): SessionStats {
		const session = this.getOrCreateSession(sessionId, agentId);

		// Update action counts
		session.actionCounts[toolName] = (session.actionCounts[toolName] || 0) + 1;

		// Track tool-specific metrics
		if (toolName === "Bash") {
			session.bashCommands++;
		} else if (toolName === "WebFetch" || toolName === "Bash") {
			if (toolName === "Bash") {
				const command = String(toolInput.command || "");
				if (command.includes("curl") || command.includes("wget")) {
					session.curlRequests++;
				}
			}
			if (toolName === "WebFetch") {
				const url = String(toolInput.url || "");
				if (url) {
					const domain = extractDomain(url);
					session.domains[domain] = (session.domains[domain] || 0) + 1;
				}
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

		return session;
	}

	/**
	 * Check if this action count warrants a baseline check.
	 */
	shouldCheckBaselines(actionCount: number): boolean {
		return actionCount % this.config.checkInterval === 0;
	}

	/**
	 * Compute anomalies for the current session against historical baselines.
	 */
	async checkBaselines(
		session: SessionStats,
		agentId?: string,
	): Promise<AnomalyResult[]> {
		if (!agentId || !this.config.enabled) {
			return [];
		}

		const baselines = await loadBaselines(this.config, this.logger);
		const agentBaselines = baselines.byAgent[agentId];

		if (!agentBaselines) {
			// No historical data yet - initialize but don't flag anomalies
			await this.updateBaselines(baselines, agentId, session);
			return [];
		}

		const anomalies: AnomalyResult[] = [];
		const actionTotal = Object.values(session.actionCounts).reduce((sum, c) => sum + c, 0);

		// Check 1: Volume anomaly (bash commands)
		if (agentBaselines.bashCommandCounts.windowSize >= 3) {
			const { mean, stdDev } = agentBaselines.bashCommandCounts;
			if (stdDev > 0) {
				const deviation = (session.bashCommands - mean) / stdDev;
				if (deviation > this.config.stdThreshold) {
					anomalies.push({
						type: "volume",
						description: `Bash command volume ${session.bashCommands.toFixed(0)} exceeds baseline (${mean.toFixed(1)} ± ${stdDev.toFixed(1)}) by ${deviation.toFixed(1)}σ`,
						severity: deviation > 3.0 ? "critical" : "warning",
						currentValue: session.bashCommands,
						baseline: agentBaselines.bashCommandCounts,
						deviation,
					});
				}
			}
		}

		// Check 2: Domain concentration
		const maxDomainCount = Math.max(0, ...Object.values(session.domains));
		if (agentBaselines.domainConcentration.windowSize >= 3) {
			const { mean, stdDev } = agentBaselines.domainConcentration;
			if (stdDev > 0 && maxDomainCount > 0) {
				const deviation = (maxDomainCount - mean) / stdDev;
				if (deviation > this.config.stdThreshold) {
					const topDomain = Object.entries(session.domains).sort((a, b) => b[1] - a[1])[0]?.[0];
					anomalies.push({
						type: "domain_concentration",
						description: `Domain concentration ${maxDomainCount} requests to ${topDomain || "single domain"} exceeds baseline (${mean.toFixed(1)} ± ${stdDev.toFixed(1)}) by ${deviation.toFixed(1)}σ`,
						severity: deviation > 3.0 ? "critical" : "warning",
						currentValue: maxDomainCount,
						baseline: agentBaselines.domainConcentration,
						deviation,
					});
				}
			}
		}

		// Check 3: File path radius expansion
		const maxDepth = session.filePaths.reduce((max, path) => {
			return Math.max(max, getDirectoryDepth(path));
		}, 0);
		if (agentBaselines.filePathRadius.windowSize >= 3) {
			const { mean, stdDev } = agentBaselines.filePathRadius;
			if (stdDev > 0 && maxDepth > 0) {
				const deviation = (maxDepth - mean) / stdDev;
				if (deviation > this.config.stdThreshold) {
					anomalies.push({
						type: "file_radius",
						description: `File access depth ${maxDepth} exceeds baseline (${mean.toFixed(1)} ± ${stdDev.toFixed(1)}) by ${deviation.toFixed(1)}σ`,
						severity: deviation > 3.0 ? "critical" : "warning",
						currentValue: maxDepth,
						baseline: agentBaselines.filePathRadius,
						deviation,
					});
				}
			}
		}

		// Update baselines with completed session data
		await this.updateBaselines(baselines, agentId, session);

		return anomalies;
	}

	/**
	 * Update rolling baselines with the current session's final stats.
	 */
	private async updateBaselines(
		baselines: BaselineStore,
		agentId: string,
		session: SessionStats,
	): Promise<void> {
		if (!baselines.byAgent[agentId]) {
			baselines.byAgent[agentId] = {
				actionCounts: {},
				bashCommandCounts: { mean: 0, stdDev: 0, windowSize: 0 },
				curlRequestCounts: { mean: 0, stdDev: 0, windowSize: 0 },
				domainConcentration: { mean: 0, stdDev: 0, windowSize: 0 },
				filePathRadius: { mean: 0, stdDev: 0, windowSize: 0 },
			};
		}

		const agentBaselines = baselines.byAgent[agentId];
		const windowSize = this.config.windowSize;

		// Update bash command baseline (sliding window)
		this.updateBaselineValue(
			agentBaselines.bashCommandCounts,
			session.bashCommands,
			windowSize,
		);

		// Update domain concentration baseline
		const maxDomainCount = Math.max(0, ...Object.values(session.domains));
		this.updateBaselineValue(
			agentBaselines.domainConcentration,
			maxDomainCount,
			windowSize,
		);

		// Update file path radius baseline
		const maxDepth = session.filePaths.reduce((max, path) => {
			return Math.max(max, getDirectoryDepth(path));
		}, 0);
		this.updateBaselineValue(
			agentBaselines.filePathRadius,
			maxDepth,
			windowSize,
		);

		// Update action counts per tool type
		for (const [toolType, count] of Object.entries(session.actionCounts)) {
			if (!agentBaselines.actionCounts[toolType]) {
				agentBaselines.actionCounts[toolType] = { mean: 0, stdDev: 0, windowSize: 0 };
			}
			this.updateBaselineValue(agentBaselines.actionCounts[toolType], count, windowSize);
		}

		await saveBaselines(this.config, baselines, this.logger);
	}

	/**
	 * Update a single baseline value using a sliding window approach.
	 * For simplicity, we use exponential moving average approximation.
	 */
	private updateBaselineValue(
		baseline: SessionBaseline,
		newValue: number,
		windowSize: number,
	): void {
		// Simple approach: treat as streaming statistics
		// Using Welford's online algorithm approximation
		const n = baseline.windowSize + 1;
		const delta = newValue - baseline.mean;
		baseline.mean = baseline.mean + delta / Math.min(n, windowSize);
		
		// Simplified variance update (not strictly Welford's but practical)
		if (baseline.windowSize >= 1) {
			const delta2 = newValue - baseline.mean;
			baseline.stdDev = Math.sqrt(
				Math.max(0, baseline.stdDev * baseline.stdDev + delta * delta2 / Math.min(n, windowSize)),
			);
		}
		
		baseline.windowSize = Math.min(n, windowSize);
	}

	/**
	 * Clean up expired sessions (no activity for >1 hour).
	 */
	cleanupExpiredSessions(maxAgeMs = 3600000): number {
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
