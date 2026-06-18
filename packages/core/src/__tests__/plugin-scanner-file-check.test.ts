import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scanPlugin } from "../plugin-scanner.js";
import type { PluginInfo } from "../types.js";

describe("scanPlugin file hash check", () => {
	const originalFetch = globalThis.fetch;
	let tempDir: string;
	let plugin: PluginInfo;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "sage-plugin-fcheck-"));
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

	it("adds FILE_CHECK finding for SEVERITY_MALWARE file", async () => {
		const fileContent = "console.log('malicious');";
		await writeFile(join(tempDir, "evil.js"), fileContent);

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				responses: [
					{
						key: { sha256: expect.any(String) },
						severity: "SEVERITY_MALWARE",
						malware_name: ["Trojan:JS/Test"],
					},
				],
			}),
		});

		// Mock fetch to capture the hash and respond with it
		const capturedHash: string[] = [];
		globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(init.body as string);
			for (const req of body.requests) {
				capturedHash.push(req.key.sha256);
			}
			return {
				ok: true,
				json: async () => ({
					responses: capturedHash.map((h) => ({
						key: { sha256: h },
						severity: "SEVERITY_MALWARE",
						malware_name: ["Trojan:JS/Test"],
					})),
				}),
			};
		});

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: true,
		});

		const fileFindings = result.findings.filter((f) => f.threatId === "FILE_CHECK");
		expect(fileFindings).toHaveLength(1);
		expect(fileFindings[0].severity).toBe("critical");
		expect(fileFindings[0].title).toContain("Trojan:JS/Test");
		expect(fileFindings[0].sourceFile).toBe("evil.js");
	});

	it("skips file hash check when checkFileHashes: false", async () => {
		await writeFile(join(tempDir, "safe.js"), "console.log('ok');");

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ responses: [] }),
		});
		globalThis.fetch = mockFetch;

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
		});

		expect(mockFetch).not.toHaveBeenCalled();
		const fileFindings = result.findings.filter((f) => f.threatId === "FILE_CHECK");
		expect(fileFindings).toHaveLength(0);
	});

	it("fails open on API error", async () => {
		await writeFile(join(tempDir, "test.js"), "console.log('test');");

		globalThis.fetch = vi.fn().mockRejectedValue(new Error("network error"));

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: true,
		});

		const fileFindings = result.findings.filter((f) => f.threatId === "FILE_CHECK");
		expect(fileFindings).toHaveLength(0);
	});

	it("de-duplicates identical file hashes", async () => {
		const content = "identical content";
		await writeFile(join(tempDir, "a.js"), content);
		await writeFile(join(tempDir, "b.js"), content);

		let fetchCallCount = 0;
		globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
			fetchCallCount++;
			const body = JSON.parse(init.body as string);
			// Only 1 unique hash should be sent
			expect(body.requests).toHaveLength(1);
			const hash = body.requests[0].key.sha256;
			return {
				ok: true,
				json: async () => ({
					responses: [
						{
							key: { sha256: hash },
							severity: "SEVERITY_MALWARE",
							malware_name: ["Malware:Generic"],
						},
					],
				}),
			};
		});

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: true,
		});

		// 1 API call with 1 unique hash
		expect(fetchCallCount).toBe(1);
		// But 2 findings (one per file)
		const fileFindings = result.findings.filter((f) => f.threatId === "FILE_CHECK");
		expect(fileFindings).toHaveLength(2);
		const sourceFiles = fileFindings.map((f) => f.sourceFile).sort();
		expect(sourceFiles).toEqual(["a.js", "b.js"]);
	});
});
