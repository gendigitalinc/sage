import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scanPlugin } from "../plugin-scanner.js";
import { addPending, listPending, loadPendingMarker, savePendingMarker } from "../skill-pending.js";
import type { PluginInfo } from "../types.js";

describe("scanPlugin skill-check integration", () => {
	const originalFetch = globalThis.fetch;
	let tempDir: string;
	let sageDir: string;
	let skillVerdictCachePath: string;
	let skillPendingPath: string;
	let plugin: PluginInfo;

	// Inject isolated cache/marker paths so the scan never touches the real ~/.sage.
	const scan = (extra: Parameters<typeof scanPlugin>[1] = {}) =>
		scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
			skillVerdictCachePath,
			skillPendingPath,
			...extra,
		});

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "sage-plugin-skill-"));
		sageDir = await mkdtemp(join(tmpdir(), "sage-skill-state-"));
		skillVerdictCachePath = join(sageDir, "skill_verdict_cache.json");
		skillPendingPath = join(sageDir, "skill_pending.json");
		plugin = {
			key: "test-plugin",
			installPath: tempDir,
			version: "1.0.0",
			lastUpdated: new Date().toISOString(),
		};
	});

	afterEach(async () => {
		globalThis.fetch = originalFetch;
		await rm(tempDir, { recursive: true, force: true });
		await rm(sageDir, { recursive: true, force: true });
	});

	async function makeSkill(relPath: string, body = "stub skill body\n"): Promise<string> {
		const dir = join(tempDir, relPath);
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, "SKILL.md"), body);
		return dir;
	}

	it("adds SKILL_CHECK finding for HIGH risk skill", async () => {
		await makeSkill("skills/audit-website");

		// Capture the skill_ids the scanner posts; the proxy answer reflects them.
		const captured: string[] = [];
		globalThis.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
			if (typeof url === "string" && url.includes("/v2/skill-check")) {
				const body = JSON.parse(init.body as string);
				captured.push(...body.skill_ids);
				const id = body.skill_ids[0] as string;
				return {
					ok: true,
					json: async () => ({
						results: {
							[id]: {
								skill_id: id,
								verdict: "HIGH",
								summary: "This skill executes remote code from an untrusted domain.",
							},
						},
					}),
				};
			}
			return { ok: true, json: async () => ({ responses: [] }) };
		});

		const result = await scan({ checkSkills: true });

		expect(captured).toHaveLength(1);
		expect(captured[0]).toMatch(/^[0-9a-f]{64}$/);

		const skillFindings = result.findings.filter((f) => f.threatId === "SKILL_CHECK");
		expect(skillFindings).toHaveLength(1);

		const finding = skillFindings[0];
		expect(finding.severity).toBe("warning");
		expect(finding.title).toContain("remote code");
		expect(finding.sourceFile).toBe(join("skills", "audit-website"));
	});

	it("upgrades severity to critical when verdict is CRITICAL", async () => {
		await makeSkill("skills/very-bad");

		globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(init.body as string);
			const id = body.skill_ids[0] as string;
			return {
				ok: true,
				json: async () => ({
					results: {
						[id]: {
							skill_id: id,
							verdict: "CRITICAL",
							summary: "do not use",
						},
					},
				}),
			};
		});

		const result = await scan();

		const skillFindings = result.findings.filter((f) => f.threatId === "SKILL_CHECK");
		expect(skillFindings).toHaveLength(1);
		expect(skillFindings[0].severity).toBe("critical");
	});

	it("caches and audits job_id for a known analyzer verdict", async () => {
		await makeSkill("skills/reportable");
		const auditPath = join(sageDir, "audit.jsonl");

		globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(init.body as string);
			const id = body.skill_ids[0] as string;
			return {
				ok: true,
				json: async () => ({
					results: {
						[id]: {
							job_id: "job-known",
							skill_id: id,
							verdict: "HIGH",
							summary: "suspicious",
						},
					},
				}),
			};
		});

		await scan({
			agentRuntime: "cursor",
			loggingConfig: {
				enabled: true,
				log_clean: false,
				path: auditPath,
				max_bytes: 5 * 1024 * 1024,
				max_files: 3,
			},
		});

		const cache = JSON.parse(await readFile(skillVerdictCachePath, "utf-8"));
		const cached = Object.values(cache.entries)[0] as Record<string, unknown>;
		expect(cached.job_id).toBe("job-known");

		const audit = JSON.parse((await readFile(auditPath, "utf-8")).trim());
		expect(audit.type).toBe("skill_verdict");
		expect(audit.job_id).toBe("job-known");
		expect(audit.entry_id).toEqual(expect.any(String));
		expect(cached.entry_id).toBe(audit.entry_id);
	});

	it("audits one entry when two folders hold the same skill", async () => {
		// Identical content ⇒ identical (content-derived) skill id, so both folders
		// share one cache row and must not each mint their own entry id.
		await makeSkill("skills/twin-a", "same body\n");
		await makeSkill("skills/twin-b", "same body\n");
		const auditPath = join(sageDir, "audit.jsonl");

		globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(init.body as string);
			const ids = body.skill_ids as string[];
			expect(new Set(ids).size).toBe(1);
			return {
				ok: true,
				json: async () => ({
					results: {
						[ids[0]]: { job_id: "job-twin", skill_id: ids[0], verdict: "HIGH" },
					},
				}),
			};
		});

		const result = await scan({
			loggingConfig: {
				enabled: true,
				log_clean: false,
				path: auditPath,
				max_bytes: 5 * 1024 * 1024,
				max_files: 3,
			},
		});

		// One finding per folder, but a single audit entry matching the cache row.
		expect(result.findings.filter((f) => f.threatId === "SKILL_CHECK")).toHaveLength(2);
		const audit = (await readFile(auditPath, "utf-8")).trim().split("\n").map(JSON.parse);
		expect(audit).toHaveLength(1);
		const cache = JSON.parse(await readFile(skillVerdictCachePath, "utf-8"));
		expect(Object.keys(cache.entries)).toHaveLength(1);
		expect((Object.values(cache.entries)[0] as Record<string, unknown>).entry_id).toBe(
			audit[0].entry_id,
		);
	});

	it("retains pending work and defers plugin caching when verdict cache persistence fails", async () => {
		const folder = await makeSkill("skills/cache-write-failure");
		skillVerdictCachePath = sageDir; // Existing directory makes atomic file replacement fail.
		const auditPath = join(sageDir, "audit.jsonl");

		globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(init.body as string);
			const id = body.skill_ids[0] as string;
			const marker = { entries: {} };
			addPending(marker, id, folder);
			await savePendingMarker(marker, skillPendingPath);
			return {
				ok: true,
				json: async () => ({
					results: {
						[id]: {
							job_id: "job-cache-failure",
							skill_id: id,
							verdict: "HIGH",
						},
					},
				}),
			};
		});

		const result = await scan({
			loggingConfig: {
				enabled: true,
				log_clean: false,
				path: auditPath,
				max_bytes: 5 * 1024 * 1024,
				max_files: 3,
			},
		});

		expect(result.deferCache).toBe(true);
		expect(listPending(await loadPendingMarker(skillPendingPath))).toHaveLength(1);
		// No "analyzed" entry: the next session re-records the verdict under a fresh
		// entry id, so an entry logged here would be an orphan.
		await expect(readFile(auditPath, "utf-8")).rejects.toThrow();
	});

	it("queues a skill the proxy returns null for (not found → upload)", async () => {
		const folder = await makeSkill("skills/unknown-null");

		globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(init.body as string);
			const id = body.skill_ids[0] as string;
			return {
				ok: true,
				json: async () => ({ results: { [id]: null } }),
			};
		});

		const result = await scan();

		// null = "not found" → no finding yet, but queued for the upload worker.
		expect(result.findings.filter((f) => f.threatId === "SKILL_CHECK")).toHaveLength(0);
		expect(result.deferCache).toBe(true); // pending verdict → don't cache this plugin
		const pending = listPending(await loadPendingMarker(skillPendingPath));
		expect(pending).toHaveLength(1);
		expect(pending[0].folder).toBe(folder);
	});

	for (const lowRisk of ["SAFE", "LOW", "MEDIUM"] as const) {
		it(`ignores ${lowRisk} risk level`, async () => {
			await makeSkill("skills/calm");

			globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
				const body = JSON.parse(init.body as string);
				const id = body.skill_ids[0] as string;
				return {
					ok: true,
					json: async () => ({
						results: {
							[id]: {
								skill_id: id,
								overall_risk_level: lowRisk,
								summary: "looks fine",
								recommendations: [],
								threat_categories: [],
							},
						},
					}),
				};
			});

			const result = await scan();

			expect(result.findings.filter((f) => f.threatId === "SKILL_CHECK")).toHaveLength(0);
		});
	}

	it("fails open on proxy 500 but defers caching so the lookup retries next session", async () => {
		await makeSkill("skills/whatever");

		globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

		const result = await scan();

		expect(result.findings).toHaveLength(0);
		// Nothing queued for upload (fail-open on outage)...
		expect(listPending(await loadPendingMarker(skillPendingPath))).toHaveLength(0);
		// ...but the plugin must NOT be cached as clean — the outage would
		// otherwise suppress skill detection for the full scan-cache TTL.
		expect(result.deferCache).toBe(true);
	});

	it("fails open on network error but defers caching so the lookup retries next session", async () => {
		await makeSkill("skills/whatever");

		globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline"));

		const result = await scan();

		expect(result.findings).toHaveLength(0);
		expect(listPending(await loadPendingMarker(skillPendingPath))).toHaveLength(0);
		expect(result.deferCache).toBe(true);
	});

	it("does not call the proxy when no SKILL.md folders exist", async () => {
		await writeFile(join(tempDir, "package.json"), '{"name":"x","version":"1"}');
		await mkdir(join(tempDir, "src"), { recursive: true });
		await writeFile(join(tempDir, "src", "index.js"), "console.log('hi');");

		const mockFetch = vi.fn();
		globalThis.fetch = mockFetch;

		const result = await scan();

		expect(mockFetch).not.toHaveBeenCalled();
		expect(result.findings).toHaveLength(0);
	});

	it("skips skill check when checkSkills: false", async () => {
		await makeSkill("skills/whatever");

		const mockFetch = vi.fn();
		globalThis.fetch = mockFetch;

		const result = await scan({ checkSkills: false });

		expect(mockFetch).not.toHaveBeenCalled();
		expect(result.findings).toHaveLength(0);
	});

	it("handles multiple skill packages in one plugin", async () => {
		await makeSkill("skills/alpha", "alpha\n");
		await makeSkill("skills/beta", "beta\n");

		globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(init.body as string);
			const ids = body.skill_ids as string[];
			expect(ids).toHaveLength(2);
			const results: Record<string, unknown> = {};
			for (const id of ids) {
				results[id] = {
					skill_id: id,
					verdict: "HIGH",
					summary: "risky",
				};
			}
			return { ok: true, json: async () => ({ results }) };
		});

		const result = await scan();

		const skillFindings = result.findings.filter((f) => f.threatId === "SKILL_CHECK");
		expect(skillFindings).toHaveLength(2);
		const sources = skillFindings.map((f) => f.sourceFile).sort();
		expect(sources).toEqual([join("skills", "alpha"), join("skills", "beta")].sort());
	});

	it("serves a cached verdict on the next scan without hitting the proxy", async () => {
		await makeSkill("skills/cached");

		// First scan: proxy returns HIGH, verdict gets cached.
		globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(init.body as string);
			const id = body.skill_ids[0] as string;
			return {
				ok: true,
				json: async () => ({
					results: {
						[id]: {
							skill_id: id,
							verdict: "HIGH",
							summary: "cached risk",
						},
					},
				}),
			};
		});
		const first = await scan();
		expect(first.findings.filter((f) => f.threatId === "SKILL_CHECK")).toHaveLength(1);

		// Second scan: proxy must NOT be called — the verdict comes from the cache.
		const failFetch = vi.fn().mockRejectedValue(new Error("proxy should not be called"));
		globalThis.fetch = failFetch;
		const second = await scan();

		expect(failFetch).not.toHaveBeenCalled();
		expect(second.findings.filter((f) => f.threatId === "SKILL_CHECK")).toHaveLength(1);
	});

	it("queues a skill the proxy has never seen in the pending marker", async () => {
		const folder = await makeSkill("skills/unknown");

		// Empty results = the proxy has no record of this skill id.
		globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: {} }) });

		const result = await scan();

		// No finding yet (unknown), but it must be queued for the upload worker.
		expect(result.findings.filter((f) => f.threatId === "SKILL_CHECK")).toHaveLength(0);

		const pending = listPending(await loadPendingMarker(skillPendingPath));
		expect(pending).toHaveLength(1);
		expect(pending[0].folder).toBe(folder);
	});

	it("does not re-queue a skill already pending", async () => {
		await makeSkill("skills/unknown");
		globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: {} }) });

		await scan();
		await scan(); // second scan: still unknown, but already pending

		const pending = listPending(await loadPendingMarker(skillPendingPath));
		expect(pending).toHaveLength(1); // not duplicated
	});

	it("lookup-only (uploadEnabled=false): looks up but never queues an unknown skill", async () => {
		await makeSkill("skills/unknown");

		// Proxy has no record of the skill (null) — would normally trigger an upload.
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: {} }) });
		globalThis.fetch = fetchMock;

		const result = await scan({ uploadEnabled: false });

		// The hash lookup still ran (we still check against known skills)...
		expect(fetchMock).toHaveBeenCalled();
		// ...but nothing is queued for upload and the plugin is not deferred.
		expect(listPending(await loadPendingMarker(skillPendingPath))).toHaveLength(0);
		expect(result.deferCache).toBeFalsy();
		expect(result.findings.filter((f) => f.threatId === "SKILL_CHECK")).toHaveLength(0);
	});

	it("grace (uploadEnabled=false + deferUnknownSkills): no queue but defers cache for next session", async () => {
		await makeSkill("skills/unknown");

		// Proxy has never seen the skill (null) — would normally trigger an upload.
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: {} }) });
		globalThis.fetch = fetchMock;

		const result = await scan({ uploadEnabled: false, deferUnknownSkills: true });

		// Grace session uploads nothing...
		expect(listPending(await loadPendingMarker(skillPendingPath))).toHaveLength(0);
		expect(result.findings.filter((f) => f.threatId === "SKILL_CHECK")).toHaveLength(0);
		// ...but the plugin must NOT cache as clean, or the next session (uploads
		// active) would cache-hit it and never queue the skill (trap 1).
		expect(result.deferCache).toBe(true);
	});

	it("lookup-only (uploadEnabled=false): still flags a known-risky skill", async () => {
		await makeSkill("skills/known-bad");

		globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(init.body as string);
			const id = body.skill_ids[0] as string;
			return {
				ok: true,
				json: async () => ({
					results: { [id]: { skill_id: id, verdict: "CRITICAL", summary: "known bad" } },
				}),
			};
		});

		const result = await scan({ uploadEnabled: false });

		const skillFindings = result.findings.filter((f) => f.threatId === "SKILL_CHECK");
		expect(skillFindings).toHaveLength(1);
		expect(skillFindings[0].severity).toBe("critical");
	});
});
