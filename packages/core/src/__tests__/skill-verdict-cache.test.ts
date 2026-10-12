import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	DEFAULT_VERDICT_TTL_MS,
	getVerdict,
	loadSkillVerdictCache,
	loadSkillVerdictCacheReadOnly,
	loadSkillVerdictCacheSync,
	putVerdict,
	riskyVerdictsSince,
	type SkillVerdictCache,
	saveSkillVerdictCache,
} from "../skill-verdict-cache.js";

const ID_A = "a".repeat(64);

describe("skill-verdict-cache", () => {
	let dir: string;
	let path: string;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "sage-verdict-"));
		path = join(dir, "skill_verdict_cache.json");
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it("put / get round-trips through disk", async () => {
		const cache: SkillVerdictCache = { entries: {} };
		putVerdict(cache, ID_A, {
			entryId: "entry-123",
			jobId: "job-123",
			verdict: "CRITICAL",
			summary: "bad",
			skillName: "evil-skill",
			sources: [{ agentRuntime: "cursor", containerKey: "skill:evil-skill@local" }],
		});
		await saveSkillVerdictCache(cache, path);

		const loaded = await loadSkillVerdictCache(path);
		const v = getVerdict(loaded, ID_A);
		expect(v?.entryId).toBe("entry-123");
		expect(v?.jobId).toBe("job-123");
		expect(v?.verdict).toBe("CRITICAL");
		expect(v?.summary).toBe("bad");
		expect(v?.skillName).toBe("evil-skill");
		expect(v?.sources).toEqual([
			{ agentRuntime: "cursor", containerKey: "skill:evil-skill@local" },
		]);
	});

	it("putVerdict unions sources across writes, deduped", () => {
		const cache: SkillVerdictCache = { entries: {} };
		putVerdict(cache, ID_A, {
			verdict: "HIGH",
			sources: [{ agentRuntime: "cursor", containerKey: "skill:utils@local" }],
		});
		putVerdict(cache, ID_A, {
			verdict: "CRITICAL",
			sources: [
				{ agentRuntime: "cursor", containerKey: "skill:utils@local" },
				{ agentRuntime: "claude-code", containerKey: "skill:utils@local" },
			],
		});

		const v = cache.entries[ID_A];
		expect(v?.verdict).toBe("CRITICAL");
		expect(v?.sources).toEqual([
			{ agentRuntime: "cursor", containerKey: "skill:utils@local" },
			{ agentRuntime: "claude-code", containerKey: "skill:utils@local" },
		]);
	});

	it("dedups sources by runtime so the array stays bounded across many plugins", () => {
		const cache: SkillVerdictCache = { entries: {} };
		// Same skill discovered in three different plugins under the same runtime.
		// containerKey is not consumed anywhere (only agentRuntime is, by the
		// status line), so these collapse to a single source — bounding growth to
		// the number of distinct runtimes rather than distinct (runtime, plugin).
		for (const containerKey of ["skill:a@local", "skill:b@local", "skill:c@local"]) {
			putVerdict(cache, ID_A, {
				verdict: "HIGH",
				sources: [{ agentRuntime: "cursor", containerKey }],
			});
		}
		const v = cache.entries[ID_A];
		expect(v?.sources).toHaveLength(1);
		expect(v?.sources?.[0]?.agentRuntime).toBe("cursor");
	});

	it("persists snake_case on disk", async () => {
		const cache: SkillVerdictCache = { entries: {} };
		putVerdict(cache, ID_A, {
			entryId: "entry-safe",
			jobId: "job-safe",
			verdict: "SAFE",
			summary: "all good",
			skillName: "my-skill",
		});
		await saveSkillVerdictCache(cache, path);

		const onDisk = JSON.parse(await readFile(path, "utf-8"));
		expect(onDisk.schema_version).toBe(1);
		expect(onDisk.entries[ID_A]).toHaveProperty("verdict", "SAFE");
		expect(onDisk.entries[ID_A]).toHaveProperty("entry_id", "entry-safe");
		expect(onDisk.entries[ID_A]).toHaveProperty("job_id", "job-safe");
		expect(onDisk.entries[ID_A]).toHaveProperty("skill_name", "my-skill");
		expect(onDisk.entries[ID_A]).toHaveProperty("analyzed_at");
	});

	it("getVerdict returns null for unknown id", () => {
		expect(getVerdict({ entries: {} }, ID_A)).toBeNull();
	});

	it("getVerdict returns null for expired entries", async () => {
		const expired = new Date(Date.now() - DEFAULT_VERDICT_TTL_MS - 1000).toISOString();
		await writeFile(
			path,
			JSON.stringify({
				schema_version: 1,
				entries: {
					[ID_A]: { verdict: "SAFE", summary: "old", analyzed_at: expired },
				},
			}),
		);

		// Loading with a larger TTL keeps the entry on disk, but getVerdict with the
		// default TTL still treats it as expired.
		const loaded = await loadSkillVerdictCache(path, DEFAULT_VERDICT_TTL_MS * 10);
		expect(getVerdict(loaded, ID_A)).toBeNull(); // expired → treated as unknown
	});

	it("honors a caller-supplied TTL for getVerdict", async () => {
		const cache: SkillVerdictCache = { entries: {} };
		putVerdict(cache, ID_A, { verdict: "HIGH", summary: "recent" });

		// Fresh under the default TTL, but expired under a zero TTL (trust nothing).
		expect(getVerdict(cache, ID_A)?.verdict).toBe("HIGH");
		expect(getVerdict(cache, ID_A, 0)).toBeNull();
	});

	it("prunes entries older than the TTL and rewrites the file", async () => {
		const ID_B = "b".repeat(64);
		const fresh = new Date(Date.now() - DEFAULT_VERDICT_TTL_MS + 5000).toISOString(); // within TTL
		const stale = new Date(Date.now() - DEFAULT_VERDICT_TTL_MS - 1000).toISOString(); // beyond TTL

		await writeFile(
			path,
			JSON.stringify({
				schema_version: 1,
				entries: {
					[ID_A]: { verdict: "HIGH", summary: "keep me", analyzed_at: fresh },
					[ID_B]: { verdict: "SAFE", summary: "delete me", analyzed_at: stale },
				},
			}),
		);

		const loaded = await loadSkillVerdictCache(path);

		// Stale entry is absent from the returned cache.
		expect(ID_A in loaded.entries).toBe(true);
		expect(ID_B in loaded.entries).toBe(false);

		// File was rewritten — stale entry is gone from disk too.
		const onDisk = JSON.parse(await readFile(path, "utf-8"));
		expect(ID_A in onDisk.entries).toBe(true);
		expect(ID_B in onDisk.entries).toBe(false);
	});

	it("read-only loading filters stale entries without rewriting the file", async () => {
		const stale = new Date(Date.now() - DEFAULT_VERDICT_TTL_MS - 1000).toISOString();
		const content = JSON.stringify({
			schema_version: 1,
			entries: { [ID_A]: { verdict: "HIGH", analyzed_at: stale } },
		});
		await writeFile(path, content);
		const before = await stat(path);

		const loaded = await loadSkillVerdictCacheReadOnly(path);

		expect(loaded.entries).toEqual({});
		const after = await stat(path);
		expect(after.mtimeMs).toBe(before.mtimeMs);
		expect(await readFile(path, "utf-8")).toBe(content);
	});

	it("fails open to empty cache on missing or corrupt file", async () => {
		expect((await loadSkillVerdictCache(join(dir, "nope.json"))).entries).toEqual({});
		await writeFile(path, "{ not json");
		expect((await loadSkillVerdictCache(path)).entries).toEqual({});
	});

	describe("loadSkillVerdictCacheSync", () => {
		it("reads entries without modifying the file", async () => {
			const stale = new Date(Date.now() - DEFAULT_VERDICT_TTL_MS - 1000).toISOString();
			const content = JSON.stringify({
				schema_version: 1,
				entries: {
					[ID_A]: { verdict: "HIGH", summary: "risky", skill_name: "my-skill", analyzed_at: stale },
				},
			});
			await writeFile(path, content);
			const before = await stat(path);

			const loaded = loadSkillVerdictCacheSync(path);

			// Even a stale entry stays on disk — the sync loader never prunes.
			expect(loaded.entries[ID_A]?.verdict).toBe("HIGH");
			expect(loaded.entries[ID_A]?.skillName).toBe("my-skill");
			expect(loaded.entries[ID_A]?.analyzedAt).toBe(stale);
			const after = await stat(path);
			expect(after.mtimeMs).toBe(before.mtimeMs);
			expect(await readFile(path, "utf-8")).toBe(content);
		});

		it("skips entries without analyzed_at", async () => {
			await writeFile(
				path,
				JSON.stringify({
					schema_version: 1,
					entries: { [ID_A]: { verdict: "HIGH", summary: "no timestamp" } },
				}),
			);
			expect(loadSkillVerdictCacheSync(path).entries).toEqual({});
		});

		it("fails open to empty cache on missing or corrupt file", async () => {
			expect(loadSkillVerdictCacheSync(join(dir, "nope.json")).entries).toEqual({});
			await writeFile(path, "{ not json");
			expect(loadSkillVerdictCacheSync(path).entries).toEqual({});
		});
	});
});

describe("riskyVerdictsSince", () => {
	const SINCE = "2026-07-03T10:00:00.000Z";

	function entry(verdict: string | undefined, analyzedAt: string, summary = "") {
		return { verdict, summary, analyzedAt };
	}

	it("returns HIGH/CRITICAL entries newer than since, newest first", () => {
		const cache: SkillVerdictCache = {
			entries: {
				freshHigh: entry("HIGH", "2026-07-03T10:05:00.000Z", "high one"),
				freshCritical: entry("CRITICAL", "2026-07-03T10:10:00.000Z", "critical one"),
			},
		};
		const risky = riskyVerdictsSince(cache, SINCE);
		expect(risky.map((v) => v.summary)).toEqual(["critical one", "high one"]);
	});

	it("matches verdicts case-insensitively", () => {
		const cache: SkillVerdictCache = {
			entries: { a: entry("high", "2026-07-03T10:05:00.000Z") },
		};
		expect(riskyVerdictsSince(cache, SINCE)).toHaveLength(1);
	});

	it("excludes pre-session and exactly-at-since entries", () => {
		const cache: SkillVerdictCache = {
			entries: {
				old: entry("HIGH", "2026-07-03T09:00:00.000Z"),
				atSince: entry("CRITICAL", SINCE),
			},
		};
		expect(riskyVerdictsSince(cache, SINCE)).toEqual([]);
	});

	it("excludes non-risky and missing verdicts", () => {
		const cache: SkillVerdictCache = {
			entries: {
				medium: entry("MEDIUM", "2026-07-03T10:05:00.000Z"),
				clean: entry("SAFE", "2026-07-03T10:06:00.000Z"),
				none: entry(undefined, "2026-07-03T10:07:00.000Z"),
			},
		};
		expect(riskyVerdictsSince(cache, SINCE)).toEqual([]);
	});

	it("skips entries with unparsable analyzedAt", () => {
		const cache: SkillVerdictCache = {
			entries: { corrupt: entry("CRITICAL", "not-a-date") },
		};
		expect(riskyVerdictsSince(cache, SINCE)).toEqual([]);
	});

	it("returns nothing for an unparsable since timestamp", () => {
		const cache: SkillVerdictCache = {
			entries: { a: entry("CRITICAL", "2026-07-03T10:05:00.000Z") },
		};
		expect(riskyVerdictsSince(cache, "garbage")).toEqual([]);
	});
});
