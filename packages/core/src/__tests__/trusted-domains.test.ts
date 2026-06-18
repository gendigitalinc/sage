import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractDomain, isTrustedDomain, loadTrustedDomains } from "../trusted-domains.js";
import type { TrustedDomain } from "../types.js";
import { makeTmpDir } from "./test-utils.js";

describe("loadTrustedDomains", () => {
	it("loads valid domains", async () => {
		const dir = await makeTmpDir();
		await writeFile(
			join(dir, "trusted.yaml"),
			`
- domain: bun.sh
  reason: "Bun package manager"
- domain: deno.land
  reason: "Deno runtime"
`,
		);
		const domains = await loadTrustedDomains(dir);
		expect(domains).toHaveLength(2);
		expect(domains[0]?.domain).toBe("bun.sh");
		expect(domains[1]?.domain).toBe("deno.land");
	});

	it("returns empty for nonexistent directory", async () => {
		const domains = await loadTrustedDomains("/nonexistent/dir");
		expect(domains).toEqual([]);
	});

	it("skips entries with missing domain", async () => {
		const dir = await makeTmpDir();
		await writeFile(
			join(dir, "trusted.yaml"),
			`
- reason: "No domain"
`,
		);
		const domains = await loadTrustedDomains(dir);
		expect(domains).toHaveLength(0);
	});

	it("skips entries with missing reason", async () => {
		const dir = await makeTmpDir();
		await writeFile(
			join(dir, "trusted.yaml"),
			`
- domain: test.com
`,
		);
		const domains = await loadTrustedDomains(dir);
		expect(domains).toHaveLength(0);
	});

	it("loads real allowlist files", async () => {
		const dir = join(import.meta.dirname, "../../../../trusted-domains");
		const domains = await loadTrustedDomains(dir);
		expect(domains.length).toBeGreaterThan(0);
	});
});

describe("extractDomain", () => {
	it("extracts domain from URL", () => {
		expect(extractDomain("https://example.com/path")).toBe("example.com");
	});

	it("lowercases domain", () => {
		expect(extractDomain("https://Example.COM/path")).toBe("example.com");
	});

	it("returns null for invalid URL", () => {
		expect(extractDomain("not a url")).toBeNull();
	});
});

describe("isTrustedDomain", () => {
	const trusted: TrustedDomain[] = [
		{ domain: "bun.sh", reason: "Bun" },
		{ domain: "github.com", reason: "GitHub" },
	];

	it("matches exact domain", () => {
		expect(isTrustedDomain("bun.sh", trusted)).toBe(true);
	});

	it("matches subdomain", () => {
		expect(isTrustedDomain("cdn.bun.sh", trusted)).toBe(true);
	});

	it("rejects partial prefix", () => {
		expect(isTrustedDomain("notbun.sh", trusted)).toBe(false);
	});

	it("is case-insensitive", () => {
		expect(isTrustedDomain("BUN.SH", trusted)).toBe(true);
	});

	it("returns false for unknown domain", () => {
		expect(isTrustedDomain("evil.com", trusted)).toBe(false);
	});
});
