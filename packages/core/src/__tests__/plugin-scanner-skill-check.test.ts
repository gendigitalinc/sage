import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scanPlugin } from "../plugin-scanner.js";
import type { PluginInfo } from "../types.js";

describe("scanPlugin skill-check integration", () => {
	const originalFetch = globalThis.fetch;
	let tempDir: string;
	let plugin: PluginInfo;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "sage-plugin-skill-"));
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
	});

	async function makeSkill(relPath: string, body = "stub skill body\n"): Promise<string> {
		const dir = join(tempDir, relPath);
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, "SKILL.md"), body);
		return dir;
	}

	it("adds SKILL_CHECK finding for HIGH risk skill (with recommendations)", async () => {
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
								overall_risk_level: "HIGH",
								recommendations: [
									"HIGH: Downloads and executes remote code",
									"AI detected serious security threats",
								],
								threat_categories: ["REMOTE_CODE_EXECUTION"],
							},
						},
					}),
				};
			}
			return { ok: true, json: async () => ({ responses: [] }) };
		});

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
			checkSkills: true,
		});

		expect(captured).toHaveLength(1);
		expect(captured[0]).toMatch(/^[0-9a-f]{64}$/);

		const skillFindings = result.findings.filter((f) => f.threatId === "SKILL_CHECK");
		expect(skillFindings).toHaveLength(1);

		const finding = skillFindings[0];
		expect(finding.severity).toBe("high");
		expect(finding.action).toBe("log");
		expect(finding.title).toContain("remote code");
		expect(finding.sourceFile).toBe(join("skills", "audit-website"));
		expect(finding.recommendations).toEqual([
			"HIGH: Downloads and executes remote code",
			"AI detected serious security threats",
		]);
	});

	it("upgrades severity to critical when overall_risk_level is CRITICAL", async () => {
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
							overall_risk_level: "CRITICAL",
							summary: "do not use",
							recommendations: ["uninstall now"],
							threat_categories: [],
						},
					},
				}),
			};
		});

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
		});

		const skillFindings = result.findings.filter((f) => f.threatId === "SKILL_CHECK");
		expect(skillFindings).toHaveLength(1);
		expect(skillFindings[0].severity).toBe("critical");
	});

	it("ignores null result (proxy has no opinion)", async () => {
		await makeSkill("skills/safe");

		globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(init.body as string);
			const id = body.skill_ids[0] as string;
			return {
				ok: true,
				json: async () => ({ results: { [id]: null } }),
			};
		});

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
		});

		expect(result.findings.filter((f) => f.threatId === "SKILL_CHECK")).toHaveLength(0);
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

			const result = await scanPlugin(plugin, {
				checkUrls: false,
				checkFileHashes: false,
			});

			expect(result.findings.filter((f) => f.threatId === "SKILL_CHECK")).toHaveLength(0);
		});
	}

	it("fails open on proxy 500", async () => {
		await makeSkill("skills/whatever");

		globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
		});

		expect(result.findings).toHaveLength(0);
	});

	it("fails open on network error", async () => {
		await makeSkill("skills/whatever");

		globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline"));

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
		});

		expect(result.findings).toHaveLength(0);
	});

	it("does not call the proxy when no SKILL.md folders exist", async () => {
		await writeFile(join(tempDir, "package.json"), '{"name":"x","version":"1"}');
		await mkdir(join(tempDir, "src"), { recursive: true });
		await writeFile(join(tempDir, "src", "index.js"), "console.log('hi');");

		const mockFetch = vi.fn();
		globalThis.fetch = mockFetch;

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
		});

		expect(mockFetch).not.toHaveBeenCalled();
		expect(result.findings).toHaveLength(0);
	});

	it("skips skill check when checkSkills: false", async () => {
		await makeSkill("skills/whatever");

		const mockFetch = vi.fn();
		globalThis.fetch = mockFetch;

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
			checkSkills: false,
		});

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
					overall_risk_level: "HIGH",
					summary: "risky",
					recommendations: ["check this"],
					threat_categories: [],
				};
			}
			return { ok: true, json: async () => ({ results }) };
		});

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
		});

		const skillFindings = result.findings.filter((f) => f.threatId === "SKILL_CHECK");
		expect(skillFindings).toHaveLength(2);
		const sources = skillFindings.map((f) => f.sourceFile).sort();
		expect(sources).toEqual([join("skills", "alpha"), join("skills", "beta")].sort());
	});
});
