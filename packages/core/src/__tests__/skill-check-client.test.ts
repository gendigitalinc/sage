import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillCheckClient } from "../clients/skill-check.js";

describe("SkillCheckClient", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("parses a HIGH verdict with recommendations", async () => {
		const id = "a".repeat(64);
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				results: {
					[id]: {
						job_id: "abc",
						skill_id: id,
						verdict: "HIGH",
						summary: "This skill executes remote code from an untrusted domain.",
						overall_risk_level: "HIGH",
						recommendations: [
							"HIGH: Downloads and executes remote code",
							"AI detected serious security threats",
						],
						threat_categories: ["REMOTE_CODE_EXECUTION"],
					},
				},
			}),
		});

		const client = new SkillCheckClient();
		const verdicts = await client.checkSkills([id]);
		const verdict = verdicts.get(id);

		expect(verdict).not.toBeNull();
		expect(verdict?.overallRiskLevel).toBe("HIGH");
		expect(verdict?.summary).toContain("remote code");
		expect(verdict?.recommendations).toHaveLength(2);
		expect(verdict?.recommendations[0]).toContain("HIGH");
		expect(verdict?.threatCategories).toEqual(["REMOTE_CODE_EXECUTION"]);
	});

	it("treats explicit null result as no opinion (and surfaces it as null)", async () => {
		const id = "b".repeat(64);
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				results: { [id]: null },
			}),
		});

		const client = new SkillCheckClient();
		const verdicts = await client.checkSkills([id]);
		expect(verdicts.has(id)).toBe(true);
		expect(verdicts.get(id)).toBeNull();
	});

	it("returns empty map for empty input", async () => {
		const mockFetch = vi.fn();
		globalThis.fetch = mockFetch;

		const client = new SkillCheckClient();
		const verdicts = await client.checkSkills([]);

		expect(verdicts.size).toBe(0);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("fails open on HTTP 500", async () => {
		const id = "c".repeat(64);
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
		});

		const client = new SkillCheckClient();
		const verdicts = await client.checkSkills([id]);
		expect(verdicts.size).toBe(0);
	});

	it("fails open on network error / timeout", async () => {
		const id = "d".repeat(64);
		globalThis.fetch = vi.fn().mockRejectedValue(new Error("timeout"));

		const client = new SkillCheckClient();
		const verdicts = await client.checkSkills([id]);
		expect(verdicts.size).toBe(0);
	});

	it("batches more than 50 ids", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ results: {} }),
		});
		globalThis.fetch = mockFetch;

		const ids = Array.from({ length: 120 }, (_, i) => i.toString(16).padStart(64, "0"));
		const client = new SkillCheckClient();
		await client.checkSkills(ids);

		expect(mockFetch).toHaveBeenCalledTimes(3);
		// First batch sends 50 ids
		const firstCall = mockFetch.mock.calls[0];
		const body = JSON.parse(firstCall[1].body as string);
		expect(body.skill_ids).toHaveLength(50);
	});

	it("preserves results from successful batches when one batch fails", async () => {
		const ids = Array.from({ length: 75 }, (_, i) => i.toString(16).padStart(64, "0"));
		const id0 = ids[0];

		let callCount = 0;
		globalThis.fetch = vi.fn().mockImplementation(async () => {
			callCount++;
			if (callCount === 2) throw new Error("network error");
			return {
				ok: true,
				json: async () => ({
					results: {
						[id0]: {
							skill_id: id0,
							overall_risk_level: "CRITICAL",
							summary: "boom",
							recommendations: ["nope"],
							threat_categories: [],
						},
					},
				}),
			};
		});

		const client = new SkillCheckClient();
		const verdicts = await client.checkSkills(ids);

		expect(verdicts.get(id0)?.overallRiskLevel).toBe("CRITICAL");
	});

	it("de-duplicates ids across batches", async () => {
		const id = "e".repeat(64);
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ results: { [id]: null } }),
		});
		globalThis.fetch = mockFetch;

		const client = new SkillCheckClient();
		await client.checkSkills([id, id, id]);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
		expect(body.skill_ids).toEqual([id]);
	});

	it("ignores non-string recommendations / categories defensively", async () => {
		const id = "f".repeat(64);
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				results: {
					[id]: {
						overall_risk_level: "HIGH",
						recommendations: ["ok", 42, null, "still ok"],
						threat_categories: [true, "RCE", 1],
					},
				},
			}),
		});

		const client = new SkillCheckClient();
		const verdict = (await client.checkSkills([id])).get(id);
		expect(verdict?.recommendations).toEqual(["ok", "still ok"]);
		expect(verdict?.threatCategories).toEqual(["RCE"]);
	});
});
