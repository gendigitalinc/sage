import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createScanHandler, nullLogger, runPluginScan } from "@gendigital/sage-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoverExtensionPlugins } from "../plugin-discovery.js";

const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..");
const THREATS_DIR = join(REPO_ROOT, "threats");
const TRUSTED_DOMAINS_DIR = join(REPO_ROOT, "trusted-domains");

describe("startup scan integration", () => {
	const originalFetch = globalThis.fetch;
	let extensionsDir: string;

	/**
	 * Mock the proxy: URL-check returns malicious for `*canary-malicious*`
	 * URLs, every other proxy call returns an empty result.
	 */
	function mockProxyFetch(): void {
		globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
			const path = typeof url === "string" ? url : "";
			if (path.includes("/url-check") && init?.body) {
				const body = JSON.parse(init.body as string) as {
					queries: Array<{ key: { "url-like": string } }>;
				};
				const answers = body.queries.map((q) => {
					const u = q.key["url-like"];
					if (u.includes("canary-malicious")) {
						return {
							key: u,
							result: {
								success: {
									classification: {
										result: {
											malicious: {
												findings: [{ "severity-name": "High", "type-name": "Phishing" }],
											},
										},
									},
								},
							},
						};
					}
					return { key: u, result: { success: { classification: { result: {} } } } };
				});
				return { ok: true, json: async () => ({ answers }) };
			}
			return { ok: true, json: async () => ({ responses: [] }) };
		});
	}

	beforeEach(async () => {
		extensionsDir = await mkdtemp(join(tmpdir(), "sage-scan-test-"));
		mockProxyFetch();
	});

	afterEach(async () => {
		globalThis.fetch = originalFetch;
		await rm(extensionsDir, { recursive: true, force: true });
	});

	it("detects canary threat in a fake extension", async () => {
		const extDir = join(extensionsDir, "evil-ext");
		await mkdir(extDir, { recursive: true });
		await writeFile(
			join(extDir, "package.json"),
			JSON.stringify({ name: "evil-ext", version: "1.0.0" }),
		);
		// Plugin scan flags malicious URLs returned by the URL-reputation
		// proxy. The canary URL is configured above to come back as
		// malicious so we get a deterministic URL_CHECK finding.
		await writeFile(
			join(extDir, "index.js"),
			'const u = "https://canary-malicious.example.test/payload";',
		);

		const plugins = await discoverExtensionPlugins(nullLogger, extensionsDir);
		expect(plugins).toHaveLength(1);

		const msg = await runPluginScan(
			nullLogger,
			"test",
			plugins,
			THREATS_DIR,
			TRUSTED_DOMAINS_DIR,
			"0.0.0-test",
			"cursor",
		);

		expect(msg).toContain("Threat Detected");
		expect(msg).toContain("evil-ext");
	});

	it("returns clean message when no threats found", async () => {
		const extDir = join(extensionsDir, "safe-ext");
		await mkdir(extDir, { recursive: true });
		await writeFile(
			join(extDir, "package.json"),
			JSON.stringify({ name: "safe-ext", version: "1.0.0" }),
		);
		await writeFile(join(extDir, "index.js"), "module.exports = {};");

		const plugins = await discoverExtensionPlugins(nullLogger, extensionsDir);
		const msg = await runPluginScan(
			nullLogger,
			"test",
			plugins,
			THREATS_DIR,
			TRUSTED_DOMAINS_DIR,
			"0.0.0-test",
			"cursor",
		);

		expect(msg).toContain("No threats found");
	});

	it("returns clean message for empty extensions directory", async () => {
		const plugins = await discoverExtensionPlugins(nullLogger, extensionsDir);
		expect(plugins).toHaveLength(0);

		const msg = await runPluginScan(
			nullLogger,
			"test",
			plugins,
			THREATS_DIR,
			TRUSTED_DOMAINS_DIR,
			"0.0.0-test",
			"vscode",
		);

		expect(msg).toContain("No threats found");
	});

	it("handles nonexistent extensions directory without throwing", async () => {
		const missing = join(extensionsDir, "does-not-exist");
		const plugins = await discoverExtensionPlugins(nullLogger, missing);
		expect(plugins).toHaveLength(0);
	});

	it("self-filters Sage extension from scan results", async () => {
		const sageDir = join(extensionsDir, "gen.sage-cursor");
		await mkdir(sageDir, { recursive: true });
		await writeFile(
			join(sageDir, "package.json"),
			JSON.stringify({ name: "sage-cursor", version: "0.8.0" }),
		);
		// URL the proxy mock above flags as malicious — ensures the
		// self-filter is what suppresses the finding (not a clean scan).
		await writeFile(
			join(sageDir, "index.js"),
			'const u = "https://canary-malicious.example.test/payload";',
		);

		let resultMsg = "";
		const handler = createScanHandler({
			logger: nullLogger,
			context: "test",
			discoverPlugins: () => discoverExtensionPlugins(nullLogger, extensionsDir),
			selfPrefix: "sage-cursor@",
			threatsDir: THREATS_DIR,
			trustedDomainsDir: TRUSTED_DOMAINS_DIR,
			version: "0.0.0-test",
			agentRuntime: "cursor",
			onResult: (msg) => {
				resultMsg = msg;
			},
		});
		await handler();

		expect(resultMsg).toContain("No threats found");
	});
});
