import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultBranding, loadBranding, loadBrandingSync } from "../branding.js";
import { formatStartupClean } from "../format.js";
import { formatDenyMessage } from "../guard.js";
import { formatStatusLine } from "../statusline.js";
import type { Branding, Verdict } from "../types.js";
import { makeTmpDir } from "./test-utils.js";

describe("defaultBranding", () => {
	it("has correct defaults", () => {
		expect(defaultBranding.product_name).toBe("Sage");
		expect(defaultBranding.banner_text).toBe("Sage");
		expect(defaultBranding.brand_key).toBeUndefined();
	});
});

describe("loadBranding", () => {
	it("returns defaults for missing file", async () => {
		const branding = await loadBranding(undefined, "/nonexistent/branding.json");
		expect(branding.product_name).toBe("Sage");
		expect(branding.banner_text).toBe("Sage");
	});

	it("returns defaults for empty file", async () => {
		const dir = await makeTmpDir();
		const path = join(dir, "branding.json");
		await writeFile(path, "");
		const branding = await loadBranding(undefined, path);
		expect(branding.product_name).toBe("Sage");
	});

	it("returns defaults for malformed JSON", async () => {
		const dir = await makeTmpDir();
		const path = join(dir, "branding.json");
		await writeFile(path, "not json");
		const branding = await loadBranding(undefined, path);
		expect(branding.product_name).toBe("Sage");
	});

	it("returns defaults for non-object JSON", async () => {
		const dir = await makeTmpDir();
		const path = join(dir, "branding.json");
		await writeFile(path, JSON.stringify([1, 2, 3]));
		const branding = await loadBranding(undefined, path);
		expect(branding.product_name).toBe("Sage");
	});

	it("loads valid partial config (product_name only)", async () => {
		const dir = await makeTmpDir();
		const path = join(dir, "branding.json");
		await writeFile(path, JSON.stringify({ product_name: "Norton Sage" }));
		const branding = await loadBranding(undefined, path);
		expect(branding.product_name).toBe("Norton Sage");
		expect(branding.banner_text).toBe("Norton Sage");
	});

	it("loads valid full config", async () => {
		const dir = await makeTmpDir();
		const path = join(dir, "branding.json");
		await writeFile(
			path,
			JSON.stringify({
				product_name: "Norton Sage",
				banner_text: "Norton Sage by Gen Digital",
				brand_key: "norton",
			}),
		);
		const branding = await loadBranding(undefined, path);
		expect(branding.product_name).toBe("Norton Sage");
		expect(branding.banner_text).toBe("Norton Sage by Gen Digital");
		expect(branding.brand_key).toBe("norton");
	});

	it("ignores extra unknown fields", async () => {
		const dir = await makeTmpDir();
		const path = join(dir, "branding.json");
		await writeFile(
			path,
			JSON.stringify({
				product_name: "Norton Sage",
				company_name: "Gen Digital",
				unknown_field: true,
			}),
		);
		const branding = await loadBranding(undefined, path);
		expect(branding.product_name).toBe("Norton Sage");
		expect(branding.banner_text).toBe("Norton Sage");
	});

	it("returns defaults when product_name exceeds max length", async () => {
		const dir = await makeTmpDir();
		const path = join(dir, "branding.json");
		await writeFile(path, JSON.stringify({ product_name: "A".repeat(65) }));
		const branding = await loadBranding(undefined, path);
		expect(branding.product_name).toBe("Sage");
	});

	it("returns defaults when product_name contains control characters", async () => {
		const dir = await makeTmpDir();
		const path = join(dir, "branding.json");
		await writeFile(path, JSON.stringify({ product_name: "Sage\x00" }));
		const branding = await loadBranding(undefined, path);
		expect(branding.product_name).toBe("Sage");
	});

	it("returns defaults when banner_text exceeds max length", async () => {
		const dir = await makeTmpDir();
		const path = join(dir, "branding.json");
		await writeFile(path, JSON.stringify({ banner_text: "B".repeat(129) }));
		const branding = await loadBranding(undefined, path);
		expect(branding.banner_text).toBe("Sage");
	});

	it("returns defaults when brand_key has invalid characters", async () => {
		const dir = await makeTmpDir();
		const path = join(dir, "branding.json");
		await writeFile(path, JSON.stringify({ brand_key: "Norton Sage" }));
		const branding = await loadBranding(undefined, path);
		expect(branding.product_name).toBe("Sage");
	});

	it("accepts valid brand_key", async () => {
		const dir = await makeTmpDir();
		const path = join(dir, "branding.json");
		await writeFile(path, JSON.stringify({ brand_key: "norton-sage_1" }));
		const branding = await loadBranding(undefined, path);
		expect(branding.brand_key).toBe("norton-sage_1");
	});
});

describe("loadBrandingSync", () => {
	it("returns defaults for missing file", () => {
		const branding = loadBrandingSync(undefined, "/nonexistent/branding.json");
		expect(branding.product_name).toBe("Sage");
		expect(branding.banner_text).toBe("Sage");
	});

	it("loads valid config", async () => {
		const dir = await makeTmpDir();
		const path = join(dir, "branding.json");
		await writeFile(
			path,
			JSON.stringify({
				product_name: "Avast Sage",
				banner_text: "Avast Sage by Gen Digital",
			}),
		);
		const branding = loadBrandingSync(undefined, path);
		expect(branding.product_name).toBe("Avast Sage");
		expect(branding.banner_text).toBe("Avast Sage by Gen Digital");
	});

	it("banner_text falls back to product_name", async () => {
		const dir = await makeTmpDir();
		const path = join(dir, "branding.json");
		await writeFile(path, JSON.stringify({ product_name: "Custom Product" }));
		const branding = loadBrandingSync(undefined, path);
		expect(branding.banner_text).toBe("Custom Product");
	});

	it("returns defaults for malformed JSON", async () => {
		const dir = await makeTmpDir();
		const path = join(dir, "branding.json");
		await writeFile(path, "{invalid");
		const branding = loadBrandingSync(undefined, path);
		expect(branding.product_name).toBe("Sage");
	});
});

// ── Format functions with custom branding ──────────────────────────

const customBranding: Branding = {
	product_name: "Norton Sage",
	banner_text: "Norton Sage by Gen Digital",
	brand_key: "norton",
};

describe("format functions with custom branding", () => {
	it("formatStartupClean uses banner_text", () => {
		const msg = formatStartupClean("1.0.0", null, customBranding);
		expect(msg).toContain("Norton Sage by Gen Digital");
		expect(msg).not.toContain("🛡️ Sage ");
	});

	it("formatStatusLine uses product_name (clean)", () => {
		const msg = formatStatusLine(0, 0, null, null, customBranding);
		expect(msg).toBe("🛡️ Norton Sage: ✅");
	});

	it("formatStatusLine uses product_name (with detections)", () => {
		const msg = formatStatusLine(2, 1, "Malware detected", "malware", customBranding);
		expect(msg).toContain("Norton Sage:");
		expect(msg).toContain("2 blocked");
		expect(msg).toContain("1 flagged");
	});

	it("formatDenyMessage uses product_name", () => {
		const verdict: Verdict = {
			decision: "deny",
			category: "malware",
			confidence: 1.0,
			severity: "critical",
			source: "heuristics",
			artifacts: [],
			matchedThreatId: null,
			reasons: ["Pipe to shell"],
		};
		const msg = formatDenyMessage(verdict, customBranding);
		expect(msg).toContain("Norton Sage blocked this action.");
		expect(msg).not.toMatch(/^Sage blocked/);
	});
});
