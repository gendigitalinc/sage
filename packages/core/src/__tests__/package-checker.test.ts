import { afterEach, describe, expect, it, vi } from "vitest";
import { PackageChecker } from "../package-checker.js";

// Mock fetch globally for registry + file-check calls
describe("PackageChecker", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	function mockNpmPackage(
		_name: string,
		opts: {
			shasum?: string;
			integrity?: string;
			createdDate?: string;
		} = {},
	) {
		return {
			"dist-tags": { latest: "1.0.0" },
			versions: {
				"1.0.0": {
					dist: {
						shasum: opts.shasum ?? "clean-sha1-hash",
						...(opts.integrity ? { integrity: opts.integrity } : {}),
					},
				},
			},
			time: {
				created: opts.createdDate ?? "2020-01-01T00:00:00.000Z",
			},
		};
	}

	function mockFileCheckResponse(severity: string, malwareName?: string) {
		return {
			responses: [
				{
					severity,
					...(malwareName ? { malware_name: [malwareName] } : {}),
				},
			],
		};
	}

	it("returns not_found for hallucinated package", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 404,
		});

		const checker = new PackageChecker({ fileCheckEnabled: false });
		const results = await checker.checkPackages([{ name: "nonexistent-pkg-xyz", registry: "npm" }]);
		expect(results).toHaveLength(1);
		expect(results[0]?.verdict).toBe("not_found");
		expect(results[0]?.confidence).toBe(0.95);
	});

	it("returns malicious for file-check MALWARE", async () => {
		const mockFetch = vi.fn();
		// First call: npm registry
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () =>
				mockNpmPackage("bad-pkg", {
					integrity: "sha256-bWFsaWNpb3VzLWhhc2gtcGxhY2Vob2xkZXItMDAwMDA=",
				}),
		});
		// Second call: file-check
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => mockFileCheckResponse("SEVERITY_MALWARE", "Trojan.Generic"),
		});
		globalThis.fetch = mockFetch;

		const checker = new PackageChecker();
		const results = await checker.checkPackages([{ name: "bad-pkg", registry: "npm" }]);
		expect(results).toHaveLength(1);
		expect(results[0]?.verdict).toBe("malicious");
		expect(results[0]?.confidence).toBe(1.0);
		expect(results[0]?.details).toContain("Malicious");
	});

	it("returns malicious for file-check PUP", async () => {
		const mockFetch = vi.fn();
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () =>
				mockNpmPackage("pup-pkg", {
					integrity: "sha256-bWFsaWNpb3VzLWhhc2gtcGxhY2Vob2xkZXItMDAwMDA=",
				}),
		});
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => mockFileCheckResponse("SEVERITY_MALWARE", "PUP.Generic [PUP]"),
		});
		globalThis.fetch = mockFetch;

		const checker = new PackageChecker();
		const results = await checker.checkPackages([{ name: "pup-pkg", registry: "npm" }]);
		expect(results[0]?.verdict).toBe("malicious");
	});

	it("returns suspicious_age for new package", async () => {
		const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
		const mockFetch = vi.fn();
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockNpmPackage("new-pkg", { createdDate: recentDate }),
		});
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => mockFileCheckResponse("SEVERITY_UNKNOWN"),
		});
		globalThis.fetch = mockFetch;

		const checker = new PackageChecker();
		const results = await checker.checkPackages([{ name: "new-pkg", registry: "npm" }]);
		expect(results[0]?.verdict).toBe("suspicious_age");
		expect(results[0]?.confidence).toBe(0.6);
	});

	it("returns clean for established package", async () => {
		const mockFetch = vi.fn();
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockNpmPackage("express"),
		});
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => mockFileCheckResponse("SEVERITY_UNKNOWN"),
		});
		globalThis.fetch = mockFetch;

		const checker = new PackageChecker();
		const results = await checker.checkPackages([{ name: "express", registry: "npm" }]);
		expect(results[0]?.verdict).toBe("clean");
	});

	it("returns unknown on registry 500 (not false not_found)", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
		});

		const checker = new PackageChecker({ fileCheckEnabled: false });
		const results = await checker.checkPackages([{ name: "express", registry: "npm" }]);
		expect(results).toHaveLength(1);
		expect(results[0]?.verdict).toBe("unknown");
		expect(results[0]?.confidence).toBe(0.6);
	});

	it("skips all scoped packages", async () => {
		const mockFetch = vi.fn();
		globalThis.fetch = mockFetch;

		const checker = new PackageChecker();
		const results = await checker.checkPackages([
			{ name: "@mycompany/internal-lib", registry: "npm" },
		]);
		expect(results).toHaveLength(1);
		expect(results[0]?.verdict).toBe("clean");
		expect(results[0]?.details).toContain("Scoped package");
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("handles multiple packages in parallel", async () => {
		const mockFetch = vi.fn();
		// Package 1: exists, clean
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockNpmPackage("pkg-a"),
		});
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => mockFileCheckResponse("SEVERITY_UNKNOWN"),
		});
		// Package 2: not found
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 404,
		});
		globalThis.fetch = mockFetch;

		const checker = new PackageChecker();
		const results = await checker.checkPackages([
			{ name: "pkg-a", registry: "npm" },
			{ name: "pkg-b", registry: "npm" },
		]);
		expect(results).toHaveLength(2);
		const verdicts = results.map((r) => r.verdict).sort();
		expect(verdicts).toContain("clean");
		expect(verdicts).toContain("not_found");
	});

	it("returns not_found for existing package with non-existent version", async () => {
		const mockFetch = vi.fn();
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				"dist-tags": { latest: "0.2.4" },
				versions: {
					"0.2.4": { dist: { shasum: "clean-hash" } },
				},
				time: { created: "2016-01-20T00:00:00.000Z" },
			}),
		});
		globalThis.fetch = mockFetch;

		const checker = new PackageChecker({ fileCheckEnabled: false });
		const results = await checker.checkPackages([
			{ name: "simple-swizzle", registry: "npm", version: "0.2.3" },
		]);
		expect(results).toHaveLength(1);
		expect(results[0]?.verdict).toBe("not_found");
		expect(results[0]?.details).toContain("version");
		expect(results[0]?.details).toContain("0.2.3");
	});

	it("simple-swizzle malicious detection via file-check", async () => {
		const _SWIZZLE_HASH = "5da2e940ce5288dfe73deca2723544c19ce4e3dc8fe32880801c6675de12db0a";
		const mockFetch = vi.fn();
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				"dist-tags": { latest: "0.2.3" },
				versions: {
					"0.2.3": {
						dist: {
							shasum: "dummy-sha1",
							integrity: "sha256-XaLpQM5SiN/nPeyicjVEwZzk49yP4yiAgBxmdd4S2wo=",
						},
					},
				},
				time: { created: "2023-01-01T00:00:00.000Z" },
			}),
		});
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => mockFileCheckResponse("SEVERITY_MALWARE", "Malware.Generic [InfoStl]"),
		});
		globalThis.fetch = mockFetch;

		const checker = new PackageChecker();
		const results = await checker.checkPackages([
			{ name: "simple-swizzle", registry: "npm", version: "0.2.3" },
		]);
		expect(results).toHaveLength(1);
		expect(results[0]?.verdict).toBe("malicious");
		expect(results[0]?.details).toContain("Malware.Generic [InfoStl]");
	});
});
