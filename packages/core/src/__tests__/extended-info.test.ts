import { writeFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
	EXTENDED_INFO_FILE_MAX_BYTES,
	EXTENDED_INFO_FILENAME,
	EXTENDED_INFO_MAX_GROUPS,
	EXTENDED_INFO_MAX_KEYS_PER_GROUP,
	EXTENDED_INFO_MAX_LEAF_CHARS,
	type ExtendedInfo,
	loadExtendedInfo,
	mergeExtendedInfo,
	resetExtendedInfoCache,
} from "../extended-info.js";
import type { Logger } from "../types.js";
import { makeTmpDir } from "./test-utils.js";

function makeLogger(): Logger & { calls: string[] } {
	const calls: string[] = [];
	return {
		debug: (msg: string) => {
			calls.push(msg);
		},
		info: () => {},
		warn: () => {},
		error: () => {},
		calls,
	} as Logger & { calls: string[] };
}

async function writeExtendedInfo(dir: string, contents: string): Promise<void> {
	await writeFile(path.join(dir, EXTENDED_INFO_FILENAME), contents, "utf8");
}

describe("loadExtendedInfo - document-level rejection", () => {
	beforeEach(() => {
		resetExtendedInfoCache();
	});

	it("returns null when the file does not exist", async () => {
		const dir = await makeTmpDir();
		expect(await loadExtendedInfo(dir)).toBeNull();
	});

	it("returns null when the file size exceeds the byte cap", async () => {
		const dir = await makeTmpDir();
		const filler = "a".repeat(EXTENDED_INFO_FILE_MAX_BYTES + 50);
		await writeExtendedInfo(dir, JSON.stringify({ identity: { guid: filler } }));

		const logger = makeLogger();
		expect(await loadExtendedInfo(dir, logger)).toBeNull();
		expect(logger.calls.some((m) => m.includes("exceeds cap"))).toBe(true);
	});

	it("returns null when the file is not valid JSON", async () => {
		const dir = await makeTmpDir();
		await writeExtendedInfo(dir, "{ not json");

		const logger = makeLogger();
		expect(await loadExtendedInfo(dir, logger)).toBeNull();
		expect(logger.calls.some((m) => m.includes("invalid JSON"))).toBe(true);
	});

	it("returns null when the top-level value is an array", async () => {
		const dir = await makeTmpDir();
		await writeExtendedInfo(dir, JSON.stringify([{ identity: { guid: "x" } }]));

		expect(await loadExtendedInfo(dir)).toBeNull();
	});

	it("returns null when the top-level value is a string primitive", async () => {
		const dir = await makeTmpDir();
		await writeExtendedInfo(dir, JSON.stringify("hello"));

		expect(await loadExtendedInfo(dir)).toBeNull();
	});

	it("returns null when the top-level value is a number primitive", async () => {
		const dir = await makeTmpDir();
		await writeExtendedInfo(dir, JSON.stringify(42));

		expect(await loadExtendedInfo(dir)).toBeNull();
	});

	it("returns null when the top-level value is null", async () => {
		const dir = await makeTmpDir();
		await writeExtendedInfo(dir, JSON.stringify(null));

		expect(await loadExtendedInfo(dir)).toBeNull();
	});

	it("returns null when top-level group count exceeds the cap (whole-file rejection)", async () => {
		const dir = await makeTmpDir();
		const groups: Record<string, Record<string, string>> = {};
		for (let i = 0; i < EXTENDED_INFO_MAX_GROUPS + 1; i++) {
			groups[`g${i}`] = { v: "x" };
		}
		await writeExtendedInfo(dir, JSON.stringify(groups));

		const logger = makeLogger();
		expect(await loadExtendedInfo(dir, logger)).toBeNull();
		expect(logger.calls.some((m) => m.includes("top-level groups exceed cap"))).toBe(true);
	});
});

describe("loadExtendedInfo - per-group sanitization", () => {
	beforeEach(() => {
		resetExtendedInfoCache();
	});

	it("drops a top-level entry whose value is a string and retains other groups", async () => {
		const dir = await makeTmpDir();
		await writeExtendedInfo(
			dir,
			JSON.stringify({
				identity: { guid: "g1" },
				bogus: "flat",
			}),
		);

		const logger = makeLogger();
		const result = await loadExtendedInfo(dir, logger);
		expect(result).toEqual({ identity: { guid: "g1" } });
		expect(logger.calls).toContain("extended-info: dropped non-object group 'bogus'");
	});

	it("drops a top-level entry whose value is an array", async () => {
		const dir = await makeTmpDir();
		await writeExtendedInfo(
			dir,
			JSON.stringify({
				identity: { guid: "g1" },
				bogus: ["a", "b"],
			}),
		);

		const result = await loadExtendedInfo(dir);
		expect(result).toEqual({ identity: { guid: "g1" } });
	});

	it("drops a top-level entry whose value is null", async () => {
		const dir = await makeTmpDir();
		await writeExtendedInfo(
			dir,
			JSON.stringify({
				identity: { guid: "g1" },
				license: null,
			}),
		);

		const result = await loadExtendedInfo(dir);
		expect(result).toEqual({ identity: { guid: "g1" } });
	});

	it("drops overflow keys deterministically by iteration order", async () => {
		const dir = await makeTmpDir();
		const big: Record<string, string> = {};
		for (let i = 0; i < EXTENDED_INFO_MAX_KEYS_PER_GROUP + 5; i++) {
			big[`k${i}`] = `v${i}`;
		}
		await writeExtendedInfo(dir, JSON.stringify({ wide: big }));

		const logger = makeLogger();
		const result = await loadExtendedInfo(dir, logger);
		const wide = result?.wide;
		expect(wide).toBeDefined();
		const keys = Object.keys(wide as Record<string, unknown>);
		expect(keys).toHaveLength(EXTENDED_INFO_MAX_KEYS_PER_GROUP);
		expect(keys[0]).toBe("k0");
		expect(keys[EXTENDED_INFO_MAX_KEYS_PER_GROUP - 1]).toBe(
			`k${EXTENDED_INFO_MAX_KEYS_PER_GROUP - 1}`,
		);
		expect(logger.calls.some((m) => m.includes("dropped overflow keys in group 'wide'"))).toBe(
			true,
		);
	});

	it("returns an empty object (not null) when every top-level group is invalid", async () => {
		const dir = await makeTmpDir();
		await writeExtendedInfo(
			dir,
			JSON.stringify({
				flat: "x",
				arr: [1, 2],
				nope: null,
			}),
		);

		expect(await loadExtendedInfo(dir)).toEqual({});
	});
});

describe("loadExtendedInfo - per-leaf sanitization", () => {
	beforeEach(() => {
		resetExtendedInfoCache();
	});

	it("drops a leaf whose value is null and keeps siblings", async () => {
		const dir = await makeTmpDir();
		await writeExtendedInfo(
			dir,
			JSON.stringify({
				identity: { guid: "g1", hwid: null, present: true },
			}),
		);

		const result = await loadExtendedInfo(dir);
		expect(result).toEqual({ identity: { guid: "g1", present: true } });
	});

	it("drops a leaf whose value is an empty array", async () => {
		const dir = await makeTmpDir();
		await writeExtendedInfo(
			dir,
			JSON.stringify({
				identity: { guid: "g1", tags: [] },
			}),
		);

		expect(await loadExtendedInfo(dir)).toEqual({ identity: { guid: "g1" } });
	});

	it("drops a leaf whose value is a nested object (no deep nesting)", async () => {
		const dir = await makeTmpDir();
		await writeExtendedInfo(
			dir,
			JSON.stringify({
				identity: { guid: "g1", deep: { x: 1 } },
			}),
		);

		expect(await loadExtendedInfo(dir)).toEqual({ identity: { guid: "g1" } });
	});

	it("retains string, number, and boolean leaves", async () => {
		const dir = await makeTmpDir();
		await writeExtendedInfo(
			dir,
			JSON.stringify({
				license: { psn: "PSN123", expires_in_days: 30, active: true },
			}),
		);

		expect(await loadExtendedInfo(dir)).toEqual({
			license: { psn: "PSN123", expires_in_days: 30, active: true },
		});
	});

	it("truncates string leaves longer than EXTENDED_INFO_MAX_LEAF_CHARS", async () => {
		const dir = await makeTmpDir();
		const longValue = "x".repeat(EXTENDED_INFO_MAX_LEAF_CHARS + 50);
		await writeExtendedInfo(
			dir,
			JSON.stringify({
				identity: { guid: longValue },
			}),
		);

		const result = await loadExtendedInfo(dir);
		const truncated = result?.identity?.guid as string;
		expect(typeof truncated).toBe("string");
		expect(truncated.length).toBe(EXTENDED_INFO_MAX_LEAF_CHARS);
	});

	it("preserves surrogate pairs when truncating string leaves", async () => {
		const dir = await makeTmpDir();
		// U+1F600 (😀) is two UTF-16 code units. Build a string that places a
		// surrogate pair exactly at the cap boundary so a naive slice would
		// produce a lone high surrogate.
		const filler = "a".repeat(EXTENDED_INFO_MAX_LEAF_CHARS - 1);
		const value = `${filler}😀tail`;
		await writeExtendedInfo(dir, JSON.stringify({ identity: { guid: value } }));

		const result = await loadExtendedInfo(dir);
		const truncated = result?.identity?.guid as string;
		expect(truncated.length).toBeLessThanOrEqual(EXTENDED_INFO_MAX_LEAF_CHARS);
		// No lone high surrogates: round-trip through UTF-8 must preserve length.
		expect(Buffer.byteLength(truncated, "utf8")).toBeGreaterThan(0);
		expect(truncated.includes("\uD83D\uDE00") || !truncated.endsWith("\uD83D")).toBe(true);
	});
});

describe("loadExtendedInfo - happy path", () => {
	beforeEach(() => {
		resetExtendedInfoCache();
	});

	it("returns a fully sanitized result for a well-formed multi-group file", async () => {
		const dir = await makeTmpDir();
		await writeExtendedInfo(
			dir,
			JSON.stringify({
				groupA: { keyA1: "valueA1", keyA2: "valueA2" },
				groupB: { keyB1: "valueB1" },
				groupC: { keyC1: "valueC1", keyC2: "valueC2" },
			}),
		);

		expect(await loadExtendedInfo(dir)).toEqual({
			groupA: { keyA1: "valueA1", keyA2: "valueA2" },
			groupB: { keyB1: "valueB1" },
			groupC: { keyC1: "valueC1", keyC2: "valueC2" },
		});
	});

	it("caches the sanitized result so repeat calls do not re-read the file", async () => {
		const dir = await makeTmpDir();
		await writeExtendedInfo(dir, JSON.stringify({ identity: { guid: "v1" } }));

		const first = await loadExtendedInfo(dir);
		expect(first).toEqual({ identity: { guid: "v1" } });

		// Rewrite — should NOT be visible until the cache is cleared.
		await writeExtendedInfo(dir, JSON.stringify({ identity: { guid: "v2" } }));
		expect(await loadExtendedInfo(dir)).toEqual({ identity: { guid: "v1" } });

		resetExtendedInfoCache();
		expect(await loadExtendedInfo(dir)).toEqual({ identity: { guid: "v2" } });
	});
});

describe("mergeExtendedInfo", () => {
	const baseExtendedInfo: ExtendedInfo = {
		identity: { extra1: "ext-extra1", extra2: "ext-extra2" },
		product: { extra_id: "ext-product" },
		license: { extra_psn: "ext-psn" },
	};

	it("returns the envelope unchanged when extendedInfo is null", () => {
		const envelope = { identity: { uuid: "sage-uuid" } };
		const result = mergeExtendedInfo(envelope, null);
		expect(result).toEqual({ identity: { uuid: "sage-uuid" } });
		expect(result).not.toBe(envelope);
	});

	it("returns the envelope unchanged (top-level shallow clone) when extendedInfo is empty", () => {
		const envelope = { identity: { uuid: "sage-uuid" } };
		const result = mergeExtendedInfo(envelope, {});
		expect(result).toEqual({ identity: { uuid: "sage-uuid" } });
		expect(result).not.toBe(envelope);
	});

	it("copies in a whole group when the envelope has no entry under that key", () => {
		const envelope = { identity: { uuid: "sage-uuid" } };
		const result = mergeExtendedInfo(envelope, baseExtendedInfo);
		expect(result.product).toEqual({ extra_id: "ext-product" });
		expect(result.license).toEqual({ extra_psn: "ext-psn" });
	});

	it("fills null and undefined leaves without overwriting existing non-null values", () => {
		const envelope = {
			identity: {
				uuid: "sage-uuid",
				extra1: null as string | null,
				extra2: undefined as string | undefined,
				other: "sage-set",
			},
		};
		const result = mergeExtendedInfo(envelope, baseExtendedInfo);
		expect(result.identity).toEqual({
			uuid: "sage-uuid",
			extra1: "ext-extra1",
			extra2: "ext-extra2",
			other: "sage-set",
		});
	});

	it("never overwrites an existing non-null leaf", () => {
		const envelope = {
			identity: { uuid: "sage-uuid", extra1: "sage-set" },
		};
		const result = mergeExtendedInfo(envelope, baseExtendedInfo);
		expect((result.identity as Record<string, unknown>).extra1).toBe("sage-set");
	});

	it("copies the whole group when the envelope has the key set to null", () => {
		const envelope = { product: null };
		const result = mergeExtendedInfo(envelope, baseExtendedInfo);
		expect(result.product).toEqual({ extra_id: "ext-product" });
	});

	it("skips a group entirely when the envelope already set it to a primitive", () => {
		const envelope = { product: "scalar-set-by-sage" };
		const result = mergeExtendedInfo(envelope, baseExtendedInfo);
		expect(result.product).toBe("scalar-set-by-sage");
	});

	it("does not mutate the original envelope at the top level", () => {
		const envelope: Record<string, unknown> = { identity: { uuid: "sage-uuid" } };
		const before = JSON.stringify(envelope);
		mergeExtendedInfo(envelope, baseExtendedInfo);
		expect(JSON.stringify(envelope)).toBe(before);
	});

	it("does not mutate the input extendedInfo group objects", () => {
		const ext: ExtendedInfo = {
			identity: { extra1: "ext-extra1" },
		};
		const envelope = { identity: { uuid: "sage-uuid" } };
		mergeExtendedInfo(envelope, ext);
		expect(ext.identity).toEqual({ extra1: "ext-extra1" });
	});
});
