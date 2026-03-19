import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { VerdictCache } from "../cache.js";
import type { CacheConfig, CachedVerdict } from "../types.js";
import { hashCommand, normalizeUrl } from "../url-utils.js";
import { makeTmpDir } from "./test-utils.js";

function makeConfig(overrides: Partial<CacheConfig> = {}): CacheConfig {
	return {
		enabled: true,
		ttl_malicious_seconds: 3600,
		ttl_clean_seconds: 86400,
		path: "/tmp/nonexistent-cache.json",
		...overrides,
	};
}

function makeVerdict(overrides: Partial<CachedVerdict> = {}): CachedVerdict {
	return {
		verdict: "allow",
		severity: "info",
		reasons: [],
		source: "test",
		...overrides,
	};
}

describe("hashCommand", () => {
	it("returns SHA-256 hex digest", () => {
		const hash = hashCommand("test command");
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("produces consistent hashes", () => {
		expect(hashCommand("foo")).toBe(hashCommand("foo"));
	});

	it("produces different hashes for different inputs", () => {
		expect(hashCommand("foo")).not.toBe(hashCommand("bar"));
	});
});

describe("VerdictCache", () => {
	let dir: string;

	beforeEach(async () => {
		dir = await makeTmpDir();
	});

	it("returns null for missing URL", async () => {
		const cache = new VerdictCache(makeConfig({ path: join(dir, "cache.json") }));
		await cache.load();
		expect(cache.getUrl("http://example.com")).toBeNull();
	});

	it("stores and retrieves URL verdict", async () => {
		const cache = new VerdictCache(makeConfig({ path: join(dir, "cache.json") }));
		await cache.load();
		const v = makeVerdict({ verdict: "deny", severity: "critical", source: "url_check" });
		cache.putUrl("http://evil.com", v, true);
		const result = cache.getUrl("http://evil.com");
		expect(result).not.toBeNull();
		expect(result?.verdict).toBe("deny");
		expect(result?.severity).toBe("critical");
	});

	it("respects TTL for malicious URLs", async () => {
		const cache = new VerdictCache(
			makeConfig({ path: join(dir, "cache.json"), ttl_malicious_seconds: 0 }),
		);
		await cache.load();
		cache.putUrl("http://evil.com", makeVerdict({ verdict: "deny" }), true);
		// TTL is 0 seconds, should already be expired
		expect(cache.getUrl("http://evil.com")).toBeNull();
	});

	it("stores and retrieves command verdict", async () => {
		const cache = new VerdictCache(makeConfig({ path: join(dir, "cache.json") }));
		await cache.load();
		const hash = hashCommand("dangerous command");
		cache.putCommand(hash, makeVerdict({ verdict: "deny" }));
		const result = cache.getCommand(hash);
		expect(result).not.toBeNull();
		expect(result?.verdict).toBe("deny");
	});

	it("persists to disk", async () => {
		const cachePath = join(dir, "cache.json");
		const cache = new VerdictCache(makeConfig({ path: cachePath }));
		await cache.load();
		cache.putUrl("http://test.com", makeVerdict(), false);
		await cache.save();

		const raw = await readFile(cachePath, "utf-8");
		const data = JSON.parse(raw);
		// URL is normalized (trailing slash added by URL constructor)
		expect(data.urls["http://test.com/"]).toBeDefined();
	});

	it("loads from existing cache file", async () => {
		const cachePath = join(dir, "cache.json");
		// Write a cache file manually
		const farFuture = "9999-12-31T23:59:59+00:00";
		await writeFile(
			cachePath,
			JSON.stringify({
				urls: {
					"http://cached.com/": {
						verdict: "deny",
						severity: "critical",
						reasons: ["cached reason"],
						source: "test",
						checkedAt: new Date().toISOString(),
						expiresAt: farFuture,
					},
				},
				commands: {},
			}),
		);

		const cache = new VerdictCache(makeConfig({ path: cachePath }));
		await cache.load();
		const result = cache.getUrl("http://cached.com");
		expect(result).not.toBeNull();
		expect(result?.verdict).toBe("deny");
	});

	it("does nothing when disabled", async () => {
		const cache = new VerdictCache(makeConfig({ enabled: false, path: join(dir, "cache.json") }));
		await cache.load();
		cache.putUrl("http://test.com", makeVerdict(), false);
		expect(cache.getUrl("http://test.com")).toBeNull();
	});

	it("normalizes URL case for cache key", async () => {
		const cache = new VerdictCache(makeConfig({ path: join(dir, "cache.json") }));
		await cache.load();
		cache.putUrl("http://EVIL.COM/path", makeVerdict({ verdict: "deny" }), true);
		// Same URL with different case should hit cache
		const result = cache.getUrl("http://evil.com/path");
		expect(result).not.toBeNull();
		expect(result?.verdict).toBe("deny");
	});

	it("normalizes URL fragment for cache key", async () => {
		const cache = new VerdictCache(makeConfig({ path: join(dir, "cache.json") }));
		await cache.load();
		cache.putUrl("http://evil.com/path#section", makeVerdict({ verdict: "deny" }), true);
		// Same URL without fragment should hit cache
		const result = cache.getUrl("http://evil.com/path");
		expect(result).not.toBeNull();
		expect(result?.verdict).toBe("deny");
	});

	it("ignores entries from an older Sage version", async () => {
		const cachePath = join(dir, "cache.json");
		const farFuture = "9999-12-31T23:59:59+00:00";
		await writeFile(
			cachePath,
			JSON.stringify({
				urls: {
					"http://cached.com/": {
						verdict: "deny",
						severity: "critical",
						reasons: ["old rule"],
						source: "heuristic",
						checkedAt: new Date().toISOString(),
						expiresAt: farFuture,
						sageVersion: "0.5.0",
					},
				},
				commands: {},
				packages: {},
			}),
		);

		const cache = new VerdictCache(makeConfig({ path: cachePath }), undefined, "0.6.0");
		await cache.load();
		expect(cache.getUrl("http://cached.com")).toBeNull();
	});

	it("returns entries matching the current Sage version", async () => {
		const cachePath = join(dir, "cache.json");
		const farFuture = "9999-12-31T23:59:59+00:00";
		await writeFile(
			cachePath,
			JSON.stringify({
				urls: {
					"http://cached.com/": {
						verdict: "deny",
						severity: "critical",
						reasons: ["still valid"],
						source: "heuristic",
						checkedAt: new Date().toISOString(),
						expiresAt: farFuture,
						sageVersion: "0.5.0",
					},
				},
				commands: {},
				packages: {},
			}),
		);

		const cache = new VerdictCache(makeConfig({ path: cachePath }), undefined, "0.5.0");
		await cache.load();
		const result = cache.getUrl("http://cached.com");
		expect(result).not.toBeNull();
		expect(result?.verdict).toBe("deny");
	});

	it("ignores entries without sageVersion when version is set", async () => {
		const cachePath = join(dir, "cache.json");
		const farFuture = "9999-12-31T23:59:59+00:00";
		await writeFile(
			cachePath,
			JSON.stringify({
				urls: {
					"http://cached.com/": {
						verdict: "deny",
						severity: "critical",
						reasons: ["old unversioned"],
						source: "heuristic",
						checkedAt: new Date().toISOString(),
						expiresAt: farFuture,
					},
				},
				commands: {},
				packages: {},
			}),
		);

		const cache = new VerdictCache(makeConfig({ path: cachePath }), undefined, "0.6.0");
		await cache.load();
		expect(cache.getUrl("http://cached.com")).toBeNull();
	});

	it("stamps sageVersion on new entries", async () => {
		const cachePath = join(dir, "cache.json");
		const cache = new VerdictCache(makeConfig({ path: cachePath }), undefined, "0.6.0");
		await cache.load();
		cache.putUrl("http://test.com", makeVerdict(), false);
		await cache.save();

		const raw = await readFile(cachePath, "utf-8");
		const data = JSON.parse(raw);
		expect(data.urls["http://test.com/"].sageVersion).toBe("0.6.0");
	});

	it("ignores stale command entries from older version", async () => {
		const cachePath = join(dir, "cache.json");
		const farFuture = "9999-12-31T23:59:59+00:00";
		const hash = hashCommand("dangerous command");
		await writeFile(
			cachePath,
			JSON.stringify({
				urls: {},
				commands: {
					[hash]: {
						verdict: "deny",
						severity: "critical",
						reasons: ["old threat"],
						source: "heuristic",
						checkedAt: new Date().toISOString(),
						expiresAt: farFuture,
						sageVersion: "0.4.0",
					},
				},
				packages: {},
			}),
		);

		const cache = new VerdictCache(makeConfig({ path: cachePath }), undefined, "0.5.0");
		await cache.load();
		expect(cache.getCommand(hash)).toBeNull();
	});

	it("ignores stale package entries from older version", async () => {
		const cachePath = join(dir, "cache.json");
		const farFuture = "9999-12-31T23:59:59+00:00";
		await writeFile(
			cachePath,
			JSON.stringify({
				urls: {},
				commands: {},
				packages: {
					"npm:evil-pkg": {
						verdict: "deny",
						severity: "critical",
						reasons: ["malicious"],
						source: "package_check",
						checkedAt: new Date().toISOString(),
						expiresAt: farFuture,
						sageVersion: "0.4.0",
					},
				},
			}),
		);

		const cache = new VerdictCache(makeConfig({ path: cachePath }), undefined, "0.5.0");
		await cache.load();
		expect(cache.getPackage("npm:evil-pkg")).toBeNull();
	});

	it("dev version skips version check (wildcard)", async () => {
		const cachePath = join(dir, "cache.json");
		const farFuture = "9999-12-31T23:59:59+00:00";
		await writeFile(
			cachePath,
			JSON.stringify({
				urls: {
					"http://cached.com/": {
						verdict: "deny",
						severity: "critical",
						reasons: ["flagged"],
						source: "heuristic",
						checkedAt: new Date().toISOString(),
						expiresAt: farFuture,
						sageVersion: "0.5.0",
					},
				},
				commands: {},
				packages: {},
			}),
		);

		const cache = new VerdictCache(makeConfig({ path: cachePath }), undefined, "dev");
		await cache.load();
		const result = cache.getUrl("http://cached.com");
		expect(result).not.toBeNull();
		expect(result?.verdict).toBe("deny");
	});

	it("save prunes stale entries from disk", async () => {
		const cachePath = join(dir, "cache.json");
		const farFuture = "9999-12-31T23:59:59+00:00";
		await writeFile(
			cachePath,
			JSON.stringify({
				urls: {
					"http://old.com/": {
						verdict: "deny",
						severity: "critical",
						reasons: ["old"],
						source: "heuristic",
						checkedAt: new Date().toISOString(),
						expiresAt: farFuture,
						sageVersion: "0.4.0",
					},
					"http://current.com/": {
						verdict: "deny",
						severity: "critical",
						reasons: ["current"],
						source: "heuristic",
						checkedAt: new Date().toISOString(),
						expiresAt: farFuture,
						sageVersion: "0.5.0",
					},
				},
				commands: {},
				packages: {},
			}),
		);

		const cache = new VerdictCache(makeConfig({ path: cachePath }), undefined, "0.5.0");
		await cache.load();
		await cache.save();

		const raw = await readFile(cachePath, "utf-8");
		const data = JSON.parse(raw);
		expect(data.urls["http://old.com/"]).toBeUndefined();
		expect(data.urls["http://current.com/"]).toBeDefined();
	});
});

describe("normalizeUrl", () => {
	it("lowercases scheme and hostname", () => {
		expect(normalizeUrl("HTTP://EXAMPLE.COM/Path")).toBe("http://example.com/Path");
	});

	it("removes fragment", () => {
		expect(normalizeUrl("http://example.com/page#section")).toBe("http://example.com/page");
	});

	it("handles malformed URLs gracefully", () => {
		expect(normalizeUrl("not-a-url")).toBe("not-a-url");
	});

	it("sorts query parameters for consistent keys", () => {
		expect(normalizeUrl("http://example.com/p?b=2&a=1")).toBe(
			normalizeUrl("http://example.com/p?a=1&b=2"),
		);
	});
});
