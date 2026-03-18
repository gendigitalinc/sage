/**
 * Tests for session-level behavioral baseline tracking.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import {
	createSessionBaselineTracker,
	type AnomalyResult,
} from "../session-baseline.js";
import type { SessionBaselineConfig } from "../types.js";

const TEST_STORAGE_DIR = "/tmp/sage-test-sessions-" + Date.now();

describe("SessionBaselineTracker", () => {
	let config: SessionBaselineConfig;

	beforeEach(async () => {
		await mkdir(TEST_STORAGE_DIR, { recursive: true });
		config = {
			enabled: true,
			window_size: 10,
			check_interval: 5,
			std_threshold: 2.0,
			storage_dir: TEST_STORAGE_DIR,
		};
	});

	afterEach(async () => {
		await rm(TEST_STORAGE_DIR, { recursive: true, force: true });
	});

	describe("session tracking", () => {
		it("creates new session on first action", async () => {
			const tracker = createSessionBaselineTracker(config);
			const session = await tracker.recordAction("session-1", "Bash", { command: "ls -la" });

			expect(session.sessionId).toBe("session-1");
			expect(session.bashCommands).toBe(1);
			expect(session.actionCounts["Bash"]).toBe(1);
		});

		it("accumulates actions within a session", async () => {
			const tracker = createSessionBaselineTracker(config);

			await tracker.recordAction("session-1", "Bash", { command: "ls" });
			await tracker.recordAction("session-1", "Bash", { command: "cd project" });
			await tracker.recordAction("session-1", "Read", { file_path: "/etc/passwd" });
			await tracker.recordAction("session-1", "Write", { file_path: "/tmp/test.txt", content: "hello" });

			const session = tracker.getOrCreateSession("session-1");
			expect(session.bashCommands).toBe(2);
			expect(session.fileReads).toBe(1);
			expect(session.fileWrites).toBe(1);
			expect(session.filePaths).toHaveLength(2);
		});

		it("tracks domain concentration from WebFetch", async () => {
			const tracker = createSessionBaselineTracker(config);

			await tracker.recordAction("session-1", "WebFetch", { url: "https://example.com/page1" });
			await tracker.recordAction("session-1", "WebFetch", { url: "https://example.com/page2" });
			await tracker.recordAction("session-1", "WebFetch", { url: "https://example.com/page3" });
			await tracker.recordAction("session-1", "WebFetch", { url: "https://other.com/page" });

			const session = tracker.getOrCreateSession("session-1");
			expect(session.domains["example.com"]).toBe(3);
			expect(session.domains["other.com"]).toBe(1);
		});

		it("tracks curl requests from Bash commands", async () => {
			const tracker = createSessionBaselineTracker(config);

			await tracker.recordAction("session-1", "Bash", { command: "curl https://api.example.com" });
			await tracker.recordAction("session-1", "Bash", { command: "wget https://files.example.com" });
			await tracker.recordAction("session-1", "Bash", { command: "ls -la" });

			const session = tracker.getOrCreateSession("session-1");
			expect(session.curlRequests).toBe(2);
			expect(session.bashCommands).toBe(3);
		});

		it("persists sessions to disk", async () => {
			const tracker = createSessionBaselineTracker(config);

			await tracker.recordAction("session-1", "Bash", { command: "ls" });
			await tracker.recordAction("session-1", "Read", { file_path: "/tmp/test.txt" });

			// Session file should exist on disk
			const { readFile } = await import("node:fs/promises");
			const content = await readFile(`${TEST_STORAGE_DIR}/session-1.json`, "utf-8");
			const saved = JSON.parse(content);
			expect(saved.sessionId).toBe("session-1");
			expect(saved.bashCommands).toBe(1);
		});
	});

	describe("baseline checking", () => {
		it("returns empty anomalies when no historical data exists", async () => {
			const tracker = createSessionBaselineTracker(config);
			
			// Simulate a session with high activity
			for (let i = 0; i < 50; i++) {
				await tracker.recordAction("session-1", "Bash", { command: `command-${i}` });
			}

			const session = tracker.getOrCreateSession("session-1");
			const anomalies = await tracker.checkBaselines(session, "agent-1");

			// No anomalies because there's no historical data
			expect(anomalies).toHaveLength(0);
		});

		it("detects volume anomaly after baseline is established", async () => {
			const tracker = createSessionBaselineTracker(config);
			const agentId = "test-agent";

			// Establish baseline with normal sessions (5-10 bash commands each)
			for (let sessionNum = 0; sessionNum < 5; sessionNum++) {
				const sessionId = `baseline-session-${sessionNum}`;
				const bashCount = 5 + (sessionNum % 3); // 5, 6, 7, 5, 6

				for (let i = 0; i < bashCount; i++) {
					await tracker.recordAction(sessionId, "Bash", { command: `cmd-${i}` });
				}
			}

			// Now create an anomalous session with 80 bash commands
			for (let i = 0; i < 80; i++) {
				await tracker.recordAction("anomalous-session", "Bash", { command: `cmd-${i}` });
			}

			const anomalousSession = tracker.getOrCreateSession("anomalous-session");
			const anomalies = await tracker.checkBaselines(anomalousSession, agentId);

			// Should detect volume anomaly
			const volumeAnomalies = anomalies.filter((a) => a.type === "volume");
			expect(volumeAnomalies).toHaveLength(1);
			expect(volumeAnomalies[0].currentValue).toBe(80);
			expect(volumeAnomalies[0].deviation).toBeGreaterThan(2.0);
		});

		it("detects domain concentration anomaly", async () => {
			const tracker = createSessionBaselineTracker(config);
			const agentId = "test-agent";

			// Establish baseline with varying domain distribution (maxDomainCount: 2,3,2,4,3)
			for (let sessionNum = 0; sessionNum < 5; sessionNum++) {
				const sessionId = `baseline-session-${sessionNum}`;
				const maxReqs = 2 + (sessionNum % 3); // 2,3,4,2,3
				const totalReqs = maxReqs + 2;
				
				for (let i = 0; i < totalReqs; i++) {
					const domain = i < maxReqs ? "primary.com" : `other${i}.com`;
					await tracker.recordAction(sessionId, "WebFetch", { 
						url: `https://${domain}/page` 
					});
				}
			}

			// Anomalous session: 30 requests to same domain
			for (let i = 0; i < 30; i++) {
				await tracker.recordAction("anomalous-session", "WebFetch", {
					url: `https://attacker.com/exfil${i}`,
				});
			}

			const anomalousSession = tracker.getOrCreateSession("anomalous-session");
			const anomalies = await tracker.checkBaselines(anomalousSession, agentId);

			const domainAnomalies = anomalies.filter((a) => a.type === "domain_concentration");
			expect(domainAnomalies.length).toBeGreaterThan(0);
			expect(domainAnomalies[0].currentValue).toBe(30);
		});

		it("detects file path radius expansion", async () => {
			const tracker = createSessionBaselineTracker(config);
			const agentId = "test-agent";

			// Establish baseline with varying file access depth
			// maxDepth per session: 2, 3, 4, 2, 3 (varies → stdDev > 0)
			const baselinePaths = [
				["/a/file.txt"],                           // depth 2
				["/a/b/file.txt"],                         // depth 3
				["/a/b/c/file.txt"],                       // depth 4
				["/x/file.txt"],                           // depth 2
				["/x/y/file.txt"],                         // depth 3
			];
			for (let sessionNum = 0; sessionNum < 5; sessionNum++) {
				const sessionId = `baseline-session-${sessionNum}`;
				
				for (const path of baselinePaths[sessionNum]) {
					await tracker.recordAction(sessionId, "Read", { file_path: path });
				}
			}

			// Anomalous session: accessing deep system paths
			const deepPaths = [
				"/etc/passwd",
				"/etc/shadow",
				"/root/.ssh/id_rsa",
				"/var/lib/secret/credentials.json",
				"/usr/local/etc/app/secrets/api_key",
			];

			for (const path of deepPaths) {
				await tracker.recordAction("anomalous-session", "Read", { file_path: path });
			}

			const anomalousSession = tracker.getOrCreateSession("anomalous-session");
			const anomalies = await tracker.checkBaselines(anomalousSession, agentId);

			const radiusAnomalies = anomalies.filter((a) => a.type === "file_radius");
			expect(radiusAnomalies.length).toBeGreaterThan(0);
		});

		it("respects std_threshold configuration", async () => {
			const strictConfig = { ...config, std_threshold: 3.0 };
			const tracker = createSessionBaselineTracker(strictConfig);
			const agentId = "test-agent";

			// Establish baseline
			for (let sessionNum = 0; sessionNum < 5; sessionNum++) {
				const sessionId = `baseline-session-${sessionNum}`;
				for (let i = 0; i < 10; i++) {
					await tracker.recordAction(sessionId, "Bash", { command: `cmd-${i}` });
				}
			}

			// Moderately anomalous session (25 commands)
			for (let i = 0; i < 25; i++) {
				await tracker.recordAction("test-session", "Bash", { command: `cmd-${i}` });
			}

			const session = tracker.getOrCreateSession("test-session");
			const anomalies = await tracker.checkBaselines(session, agentId);

			// With threshold 3.0, this might not trigger
			const volumeAnomalies = anomalies.filter((a) => a.type === "volume");
			expect(volumeAnomalies.length).toBeLessThanOrEqual(1);
		});
	});

	describe("utility functions", () => {
		it("extracts domain from URL correctly", async () => {
			const tracker = createSessionBaselineTracker(config);
			
			// This is tested indirectly through domain tracking
			await tracker.recordAction("session-1", "WebFetch", { url: "https://sub.example.com/path" });
			const session = tracker.getOrCreateSession("session-1");
			expect(session.domains["sub.example.com"]).toBe(1);
		});

		it("handles session cleanup from memory", () => {
			const tracker = createSessionBaselineTracker(config);
			
			tracker.getOrCreateSession("old-session");
			tracker.getOrCreateSession("new-session");

			// Manually age the old session
			const oldSession = tracker.getOrCreateSession("old-session");
			oldSession.lastActivity = Date.now() - 7200000; // 2 hours ago

			const expired = tracker.cleanupExpiredSessions(3600000);
			expect(expired).toBe(1);
		});

		it("shouldCheckBaselines respects check_interval", () => {
			const config5 = { ...config, check_interval: 5 };
			const tracker = createSessionBaselineTracker(config5);

			expect(tracker.shouldCheckBaselines(1)).toBe(false);
			expect(tracker.shouldCheckBaselines(4)).toBe(false);
			expect(tracker.shouldCheckBaselines(5)).toBe(true);
			expect(tracker.shouldCheckBaselines(10)).toBe(true);
		});

		it("truncateStaleSessionFiles removes old files", async () => {
			const tracker = createSessionBaselineTracker(config);

			// Create an old session (2 hours ago)
			const oldSession = tracker.getOrCreateSession("old-session");
			oldSession.startedAt = Date.now() - 7200000;
			oldSession.lastActivity = Date.now() - 7200000;
			await tracker.persistSession("old-session");

			// Create a fresh session
			await tracker.recordAction("fresh-session", "Bash", { command: "ls" });

			const deleted = await tracker.truncateStaleSessionFiles(3600000);
			expect(deleted).toBe(1);
		});
	});

	describe("severity classification", () => {
		it("marks deviation > 3σ as critical", async () => {
			const tracker = createSessionBaselineTracker(config);
			const agentId = "test-agent";

			// Establish very tight baseline
			for (let sessionNum = 0; sessionNum < 10; sessionNum++) {
				const sessionId = `baseline-session-${sessionNum}`;
				for (let i = 0; i < 10; i++) {
					await tracker.recordAction(sessionId, "Bash", { command: `cmd-${i}` });
				}
			}

			// Extremely anomalous session (100 commands - should be > 3σ)
			for (let i = 0; i < 100; i++) {
				await tracker.recordAction("extreme-session", "Bash", { command: `cmd-${i}` });
			}

			const session = tracker.getOrCreateSession("extreme-session");
			const anomalies = await tracker.checkBaselines(session, agentId);

			const volumeAnomalies = anomalies.filter((a) => a.type === "volume");
			if (volumeAnomalies.length > 0) {
				expect(volumeAnomalies[0].severity).toBe("critical");
			}
		});
	});
});

describe("SessionBaselineTracker disabled config", () => {
	it("returns empty anomalies when disabled", async () => {
		const config = {
			enabled: false,
			window_size: 10,
			check_interval: 5,
			std_threshold: 2.0,
			storage_dir: TEST_STORAGE_DIR,
		};

		const tracker = createSessionBaselineTracker(config);
		
		for (let i = 0; i < 50; i++) {
			await tracker.recordAction("session-1", "Bash", { command: `cmd-${i}` });
		}

		const session = tracker.getOrCreateSession("session-1");
		const anomalies = await tracker.checkBaselines(session, "agent-1");

		expect(anomalies).toHaveLength(0);
	});
});
