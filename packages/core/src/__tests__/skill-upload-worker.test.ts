import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillAnalyzeResult } from "../clients/skill-analyze.js";
import { addPending, isPending, loadPendingMarker, savePendingMarker } from "../skill-pending.js";
import { runSkillUploadWorker, type SkillAnalyzer } from "../skill-upload-worker.js";
import { getVerdict, loadSkillVerdictCache } from "../skill-verdict-cache.js";

const ID = "a".repeat(64);

const CRITICAL: SkillAnalyzeResult = {
	jobId: "job-1",
	verdict: "CRITICAL",
	summary: "reverse shell",
};

describe("runSkillUploadWorker", () => {
	let dir: string;
	let pendingPath: string;
	let verdictCachePath: string;
	let skillFolder: string;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "sage-worker-"));
		pendingPath = join(dir, "skill_pending.json");
		verdictCachePath = join(dir, "skill_verdict_cache.json");
		skillFolder = join(dir, "my-skill");
		await mkdir(skillFolder);
		await writeFile(join(skillFolder, "SKILL.md"), "# skill");

		const marker = { entries: {} };
		addPending(marker, ID, skillFolder);
		await savePendingMarker(marker, pendingPath);
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it("uploads pending skill, caches verdict, clears marker", async () => {
		const client: SkillAnalyzer = { analyzeZip: vi.fn().mockResolvedValue(CRITICAL) };

		const result = await runSkillUploadWorker({ pendingPath, verdictCachePath, client });

		expect(result).toEqual({ analyzed: 1, retained: 0 });

		const cache = await loadSkillVerdictCache(verdictCachePath);
		expect(getVerdict(cache, ID)?.jobId).toBe("job-1");
		expect(getVerdict(cache, ID)?.verdict).toBe("CRITICAL");
		expect(getVerdict(cache, ID)?.summary).toBe("reverse shell");

		const marker = await loadPendingMarker(pendingPath);
		expect(isPending(marker, ID)).toBe(false); // cleared
	});

	it("logs job id and analyzer verdict for false-positive reporting", async () => {
		const auditPath = join(dir, "audit.jsonl");
		const client: SkillAnalyzer = { analyzeZip: vi.fn().mockResolvedValue(CRITICAL) };

		await runSkillUploadWorker({
			pendingPath,
			verdictCachePath,
			client,
			agentRuntime: "cursor",
			loggingConfig: {
				enabled: true,
				log_clean: false,
				path: auditPath,
				max_bytes: 5 * 1024 * 1024,
				max_files: 3,
			},
		});

		const entry = JSON.parse((await readFile(auditPath, "utf-8")).trim());
		expect(entry.entry_id).toEqual(expect.any(String));
		expect(getVerdict(await loadSkillVerdictCache(verdictCachePath), ID)?.entryId).toBe(
			entry.entry_id,
		);
		expect(entry.job_id).toBe("job-1");
		expect(entry.agent_runtime).toBe("cursor");
		expect(entry.signals.skill_checks[0]).toEqual({
			detection_name: `Other:SageMaliciousSkill-A [Trj]|skan:${ID}|sage`,
			skill_id: ID,
			job_id: "job-1",
			analyzer_verdict: "CRITICAL",
		});
	});

	it("caches a reportable ID when its audit entry cannot be written", async () => {
		const client: SkillAnalyzer = { analyzeZip: vi.fn().mockResolvedValue(CRITICAL) };

		const result = await runSkillUploadWorker({
			pendingPath,
			verdictCachePath,
			client,
			loggingConfig: {
				enabled: true,
				log_clean: false,
				path: dir,
				max_bytes: 5 * 1024 * 1024,
				max_files: 3,
			},
		});

		expect(result).toEqual({ analyzed: 1, retained: 0 });
		expect(isPending(await loadPendingMarker(pendingPath), ID)).toBe(false);
		const cached = getVerdict(await loadSkillVerdictCache(verdictCachePath), ID);
		expect(cached?.entryId).toEqual(expect.any(String));
		expect(cached?.jobId).toBe("job-1");
	});

	it("keeps analyzed work pending when the verdict cache cannot be written", async () => {
		const auditPath = join(dir, "audit.jsonl");
		const client: SkillAnalyzer = { analyzeZip: vi.fn().mockResolvedValue(CRITICAL) };

		const result = await runSkillUploadWorker({
			pendingPath,
			verdictCachePath: dir,
			client,
			loggingConfig: {
				enabled: true,
				log_clean: false,
				path: auditPath,
				max_bytes: 5 * 1024 * 1024,
				max_files: 3,
			},
		});

		expect(result).toEqual({ analyzed: 0, retained: 1 });
		expect(isPending(await loadPendingMarker(pendingPath), ID)).toBe(true);
		// No "analyzed" entry: the retry gets a fresh entry id, so an entry logged
		// here would be an orphan no cache row ever joins to.
		await expect(readFile(auditPath, "utf-8")).rejects.toThrow();
	});

	it("clears non-risky work even when its audit entry cannot be written", async () => {
		const client: SkillAnalyzer = {
			analyzeZip: vi.fn().mockResolvedValue({ jobId: "job-safe", verdict: "SAFE" }),
		};

		const result = await runSkillUploadWorker({
			pendingPath,
			verdictCachePath,
			client,
			loggingConfig: {
				enabled: true,
				log_clean: false,
				path: dir,
				max_bytes: 5 * 1024 * 1024,
				max_files: 3,
			},
		});

		expect(result).toEqual({ analyzed: 1, retained: 0 });
		expect(isPending(await loadPendingMarker(pendingPath), ID)).toBe(false);
	});

	it("passes the skill id and a slug to the analyzer", async () => {
		const analyzeZip = vi.fn().mockResolvedValue(CRITICAL);
		await runSkillUploadWorker({ pendingPath, verdictCachePath, client: { analyzeZip } });

		const [zip, metadata] = analyzeZip.mock.calls[0];
		expect(zip).toBeInstanceOf(Uint8Array);
		expect(metadata).toEqual({ skillId: ID, slug: "my-skill" });
	});

	it("fail-open: keeps skill pending and writes no verdict when analyzer returns null", async () => {
		const client: SkillAnalyzer = { analyzeZip: vi.fn().mockResolvedValue(null) };

		const result = await runSkillUploadWorker({ pendingPath, verdictCachePath, client });

		expect(result).toEqual({ analyzed: 0, retained: 1 });
		const marker = await loadPendingMarker(pendingPath);
		expect(isPending(marker, ID)).toBe(true); // retained for retry
		const cache = await loadSkillVerdictCache(verdictCachePath);
		expect(getVerdict(cache, ID)).toBeNull();
	});

	it("fail-open: one failing skill does not block the others", async () => {
		const ID2 = "b".repeat(64);
		const folder2 = join(dir, "skill-2");
		await mkdir(folder2);
		await writeFile(join(folder2, "SKILL.md"), "# two");
		const marker = await loadPendingMarker(pendingPath);
		addPending(marker, ID2, folder2);
		await savePendingMarker(marker, pendingPath);

		const analyzeZip = vi
			.fn()
			.mockRejectedValueOnce(new Error("boom")) // first skill throws
			.mockResolvedValueOnce(CRITICAL); // second succeeds
		const result = await runSkillUploadWorker({
			pendingPath,
			verdictCachePath,
			client: { analyzeZip },
		});

		expect(result.analyzed).toBe(1);
		expect(result.retained).toBe(1);
	});

	it("removes oversized skill from pending and caches a sentinel verdict", async () => {
		await writeFile(join(skillFolder, "large.bin"), Buffer.alloc(51 * 1024 * 1024));
		const client: SkillAnalyzer = { analyzeZip: vi.fn() };

		const result = await runSkillUploadWorker({ pendingPath, verdictCachePath, client });

		expect(result).toEqual({ analyzed: 0, retained: 0 });
		expect(client.analyzeZip).not.toHaveBeenCalled();
		// Skill must be removed from pending so deferCache stops firing.
		const marker = await loadPendingMarker(pendingPath);
		expect(isPending(marker, ID)).toBe(false);
		// Sentinel verdict (no verdict string) must be cached so the scanner
		// doesn't re-enqueue it on the next session.
		const cache = await loadSkillVerdictCache(verdictCachePath);
		const entry = getVerdict(cache, ID);
		expect(entry).not.toBeNull();
		expect(entry?.verdict).toBeUndefined();
	});

	it("never uploads a skill with no readable entries; caches a sentinel instead", async () => {
		// Emptied between the scan that queued it and this worker run. Zipping it
		// would produce a 22-byte member-less archive the analyzer rejects with a
		// 400, which fails open to no_verdict and re-uploads it every session.
		await rm(join(skillFolder, "SKILL.md"));
		const client: SkillAnalyzer = { analyzeZip: vi.fn() };

		const result = await runSkillUploadWorker({ pendingPath, verdictCachePath, client });

		expect(result).toEqual({ analyzed: 0, retained: 0 });
		expect(client.analyzeZip).not.toHaveBeenCalled();
		// Terminal, not retried: dropped from pending and given a sentinel verdict.
		const marker = await loadPendingMarker(pendingPath);
		expect(isPending(marker, ID)).toBe(false);
		const entry = getVerdict(await loadSkillVerdictCache(verdictCachePath), ID);
		expect(entry).not.toBeNull();
		expect(entry?.verdict).toBeUndefined();
	});

	it("keeps a deleted skill folder pending (retryable), unlike an empty one", async () => {
		// Contrast with the empty case: an unreadable folder is a transient error,
		// so it must stay pending rather than being cached as terminal.
		await rm(skillFolder, { recursive: true, force: true });
		const client: SkillAnalyzer = { analyzeZip: vi.fn() };

		const result = await runSkillUploadWorker({ pendingPath, verdictCachePath, client });

		expect(result).toEqual({ analyzed: 0, retained: 1 });
		expect(client.analyzeZip).not.toHaveBeenCalled();
		const marker = await loadPendingMarker(pendingPath);
		expect(isPending(marker, ID)).toBe(true);
	});

	it("processes 4 skills across two batches, all analyzed and cleared", async () => {
		const ids = [ID, "b".repeat(64), "c".repeat(64), "d".repeat(64)];
		const folders = [skillFolder];
		for (let i = 1; i < 4; i++) {
			const f = join(dir, `skill-${i}`);
			await mkdir(f);
			await writeFile(join(f, "SKILL.md"), `# skill ${i}`);
			folders.push(f);
		}
		const marker = await loadPendingMarker(pendingPath);
		for (let i = 1; i < 4; i++) addPending(marker, ids[i], folders[i]);
		await savePendingMarker(marker, pendingPath);

		const analyzeZip = vi.fn().mockResolvedValue(CRITICAL);
		const result = await runSkillUploadWorker({
			pendingPath,
			verdictCachePath,
			client: { analyzeZip },
		});

		expect(result).toEqual({ analyzed: 4, retained: 0 });
		expect(analyzeZip).toHaveBeenCalledTimes(4);
		const cache = await loadSkillVerdictCache(verdictCachePath);
		for (const id of ids) expect(getVerdict(cache, id)?.verdict).toBe("CRITICAL");
		const fresh = await loadPendingMarker(pendingPath);
		for (const id of ids) expect(isPending(fresh, id)).toBe(false);
	});

	it("no-op when nothing is pending", async () => {
		await savePendingMarker({ entries: {} }, pendingPath);
		const client: SkillAnalyzer = { analyzeZip: vi.fn() };
		const result = await runSkillUploadWorker({ pendingPath, verdictCachePath, client });
		expect(result).toEqual({ analyzed: 0, retained: 0 });
		expect(client.analyzeZip).not.toHaveBeenCalled();
	});
});
