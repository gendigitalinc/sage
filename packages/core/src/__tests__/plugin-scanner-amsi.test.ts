import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AmsiClient } from "../clients/amsi.js";
import { scanPlugin } from "../plugin-scanner.js";
import type { PluginInfo } from "../types.js";

function createMockAmsiClient(overrides: Partial<AmsiClient> = {}): AmsiClient & {
	mockScanString: ReturnType<typeof vi.fn>;
	mockClose: ReturnType<typeof vi.fn>;
} {
	const mockScanString = vi.fn().mockResolvedValue(null);
	const mockClose = vi.fn();

	return {
		isAvailable: true,
		init: vi.fn().mockResolvedValue(undefined),
		scanString: mockScanString,
		close: mockClose,
		mockScanString,
		mockClose,
		...overrides,
	};
}

describe("scanPlugin AMSI scanning", () => {
	let tempDir: string;
	let plugin: PluginInfo;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "sage-plugin-amsi-"));
		plugin = {
			key: "test-plugin",
			installPath: tempDir,
			version: "1.0.0",
			lastUpdated: new Date().toISOString(),
		};
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("adds AMSI_SCAN finding when AMSI detects a threat", async () => {
		await writeFile(join(tempDir, "evil.js"), "malicious content here");
		const client = createMockAmsiClient();
		client.mockScanString.mockResolvedValue({
			content: "malicious content here",
			contentName: "[Sage:Plugin]:test-plugin/evil.js",
			amsiResult: 32768,
			isDetected: true,
			isBlockedByAdmin: false,
		});

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
			amsiClient: client,
		});

		const amsiFindings = result.findings.filter((f) => f.threatId === "AMSI_SCAN");
		expect(amsiFindings).toHaveLength(1);
		expect(amsiFindings[0].severity).toBe("critical");
		expect(amsiFindings[0].action).toBe("block");
		expect(amsiFindings[0].title).toContain("32768");
		expect(amsiFindings[0].sourceFile).toBe("evil.js");
		expect(client.mockScanString).toHaveBeenCalledWith(
			"Plugin",
			"test-plugin/evil.js",
			"malicious content here",
		);
	});

	it("adds AMSI_SCAN finding when blocked by admin", async () => {
		await writeFile(join(tempDir, "blocked.js"), "blocked content");
		const client = createMockAmsiClient();
		client.mockScanString.mockResolvedValue({
			content: "blocked content",
			contentName: "[Sage:Plugin]:test-plugin/blocked.js",
			amsiResult: 16384,
			isDetected: false,
			isBlockedByAdmin: true,
		});

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
			amsiClient: client,
		});

		const amsiFindings = result.findings.filter((f) => f.threatId === "AMSI_SCAN");
		expect(amsiFindings).toHaveLength(1);
		expect(amsiFindings[0].title).toContain("16384");
	});

	it("produces no finding when AMSI returns clean", async () => {
		await writeFile(join(tempDir, "safe.js"), "console.log('ok');");
		const client = createMockAmsiClient();
		client.mockScanString.mockResolvedValue({
			content: "console.log('ok');",
			contentName: "[Sage:Plugin]:test-plugin/safe.js",
			amsiResult: 0,
			isDetected: false,
			isBlockedByAdmin: false,
		});

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
			amsiClient: client,
		});

		const amsiFindings = result.findings.filter((f) => f.threatId === "AMSI_SCAN");
		expect(amsiFindings).toHaveLength(0);
	});

	it("produces no finding when AMSI returns null", async () => {
		await writeFile(join(tempDir, "safe.js"), "console.log('ok');");
		const client = createMockAmsiClient();

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
			amsiClient: client,
		});

		const amsiFindings = result.findings.filter((f) => f.threatId === "AMSI_SCAN");
		expect(amsiFindings).toHaveLength(0);
	});

	it("skips AMSI when no client provided", async () => {
		await writeFile(join(tempDir, "test.js"), "content");

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
		});

		expect(result.findings).toHaveLength(0);
	});

	it("fails open when scanString throws", async () => {
		await writeFile(join(tempDir, "test.js"), "content");
		const client = createMockAmsiClient();
		client.mockScanString.mockRejectedValue(new Error("scan error"));

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
			amsiClient: client,
		});

		const amsiFindings = result.findings.filter((f) => f.threatId === "AMSI_SCAN");
		expect(amsiFindings).toHaveLength(0);
	});

	it("does not close the client (caller owns lifecycle)", async () => {
		await writeFile(join(tempDir, "test.js"), "content");
		const client = createMockAmsiClient();

		await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
			amsiClient: client,
		});

		expect(client.mockClose).not.toHaveBeenCalled();
	});

	it("scans multiple files with a single client", async () => {
		await writeFile(join(tempDir, "a.js"), "file a");
		await writeFile(join(tempDir, "b.js"), "file b");
		const client = createMockAmsiClient();
		client.mockScanString
			.mockResolvedValueOnce({
				content: "file a",
				contentName: "[Sage:Plugin]:test-plugin/a.js",
				amsiResult: 32768,
				isDetected: true,
				isBlockedByAdmin: false,
			})
			.mockResolvedValueOnce({
				content: "file b",
				contentName: "[Sage:Plugin]:test-plugin/b.js",
				amsiResult: 0,
				isDetected: false,
				isBlockedByAdmin: false,
			});

		const result = await scanPlugin(plugin, {
			checkUrls: false,
			checkFileHashes: false,
			amsiClient: client,
		});

		expect(client.mockScanString).toHaveBeenCalledTimes(2);
		const amsiFindings = result.findings.filter((f) => f.threatId === "AMSI_SCAN");
		expect(amsiFindings).toHaveLength(1);
		expect(amsiFindings[0].sourceFile).toBe("a.js");
	});
});
