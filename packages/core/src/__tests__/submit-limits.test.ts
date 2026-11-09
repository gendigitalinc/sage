import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	canSubmitRule,
	claimRuleSubmissions,
	loadSubmitLimits,
	recordRuleSubmission,
	SUBMIT_WINDOW_MS,
} from "../submit-limits.js";
import { makeTmpDir } from "./test-utils.js";

const T0 = 1_700_000_000_000;

describe("submit limits", () => {
	it("allows a rule with no prior record", async () => {
		const sageDirPath = await makeTmpDir();
		expect(await canSubmitRule("R-1", { sageDirPath, now: T0 })).toBe(true);
	});

	it("rejects a rule submitted less than 24h ago", async () => {
		const sageDirPath = await makeTmpDir();
		await recordRuleSubmission("R-1", { sageDirPath, now: T0 });
		expect(await canSubmitRule("R-1", { sageDirPath, now: T0 + 1 })).toBe(false);
		expect(await canSubmitRule("R-1", { sageDirPath, now: T0 + SUBMIT_WINDOW_MS - 1 })).toBe(false);
	});

	it("allows a rule again once 24h have elapsed", async () => {
		const sageDirPath = await makeTmpDir();
		await recordRuleSubmission("R-1", { sageDirPath, now: T0 });
		expect(await canSubmitRule("R-1", { sageDirPath, now: T0 + SUBMIT_WINDOW_MS })).toBe(true);
	});

	it("caps each rule independently", async () => {
		const sageDirPath = await makeTmpDir();
		await recordRuleSubmission("R-1", { sageDirPath, now: T0 });
		expect(await canSubmitRule("R-2", { sageDirPath, now: T0 + 1 })).toBe(true);
	});

	it("persists state to disk in snake_case and reloads it", async () => {
		const sageDirPath = await makeTmpDir();
		await recordRuleSubmission("R-1", { sageDirPath, now: T0 });

		const raw = JSON.parse(await readFile(join(sageDirPath, "submit-limits.json"), "utf8"));
		expect(raw).toEqual({ schema_version: 1, rules: { "R-1": { last_submitted_ms: T0 } } });
		expect(await loadSubmitLimits({ sageDirPath })).toEqual({ "R-1": T0 });
	});

	it("creates the sage dir when it does not exist", async () => {
		const sageDirPath = join(await makeTmpDir(), "nested", ".sage");
		expect(await claimRuleSubmissions(["R-1"], { sageDirPath, now: T0 })).toEqual(["R-1"]);
		expect(await canSubmitRule("R-1", { sageDirPath, now: T0 + 1 })).toBe(false);
	});

	it("does not lock a rule out when its timestamp is in the future", async () => {
		const sageDirPath = await makeTmpDir();
		await recordRuleSubmission("R-1", { sageDirPath, now: T0 + SUBMIT_WINDOW_MS * 10 });
		expect(await canSubmitRule("R-1", { sageDirPath, now: T0 })).toBe(true);
	});

	describe("claimRuleSubmissions", () => {
		it("claims only eligible rules and records them", async () => {
			const sageDirPath = await makeTmpDir();
			await recordRuleSubmission("R-1", { sageDirPath, now: T0 });

			const claimed = await claimRuleSubmissions(["R-1", "R-2", "R-2"], {
				sageDirPath,
				now: T0 + 1000,
			});
			expect(claimed).toEqual(["R-2"]);
			expect(await loadSubmitLimits({ sageDirPath })).toEqual({ "R-1": T0, "R-2": T0 + 1000 });
		});

		it("returns [] and writes nothing when every rule is capped", async () => {
			const sageDirPath = await makeTmpDir();
			await recordRuleSubmission("R-1", { sageDirPath, now: T0 });
			expect(await claimRuleSubmissions(["R-1"], { sageDirPath, now: T0 + 1 })).toEqual([]);
			expect(await loadSubmitLimits({ sageDirPath })).toEqual({ "R-1": T0 });
		});

		it("returns [] for an empty rule list", async () => {
			const sageDirPath = await makeTmpDir();
			expect(await claimRuleSubmissions([], { sageDirPath, now: T0 })).toEqual([]);
		});

		it("prunes expired entries on write", async () => {
			const sageDirPath = await makeTmpDir();
			await recordRuleSubmission("OLD", { sageDirPath, now: T0 });
			await claimRuleSubmissions(["NEW"], { sageDirPath, now: T0 + SUBMIT_WINDOW_MS + 1 });
			expect(await loadSubmitLimits({ sageDirPath })).toEqual({
				NEW: T0 + SUBMIT_WINDOW_MS + 1,
			});
		});

		it("treats a corrupt file as empty", async () => {
			const sageDirPath = await makeTmpDir();
			await writeFile(join(sageDirPath, "submit-limits.json"), "{not json");
			expect(await claimRuleSubmissions(["R-1"], { sageDirPath, now: T0 })).toEqual(["R-1"]);
		});

		it("ignores malformed entries", async () => {
			const sageDirPath = await makeTmpDir();
			await writeFile(
				join(sageDirPath, "submit-limits.json"),
				JSON.stringify({
					rules: { A: { last_submitted_ms: "x" }, B: null, C: { last_submitted_ms: T0 } },
				}),
			);
			expect(await loadSubmitLimits({ sageDirPath })).toEqual({ C: T0 });
		});

		it("suppresses the submission (without throwing) when state cannot be persisted", async () => {
			const base = await makeTmpDir();
			// A regular file where the sage dir should be makes every write fail.
			const sageDirPath = join(base, "blocked");
			await writeFile(sageDirPath, "");
			await expect(claimRuleSubmissions(["R-1"], { sageDirPath, now: T0 })).resolves.toEqual([]);
		});

		it("suppresses the submission when the lock is held by another process", async () => {
			const sageDirPath = await makeTmpDir();
			await mkdir(join(sageDirPath, "submit-limits.json.lock"));
			expect(await claimRuleSubmissions(["R-1"], { sageDirPath, now: T0 })).toEqual([]);
		});
	});
});
