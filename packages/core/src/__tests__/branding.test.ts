import { describe, expect, it } from "vitest";
import { BRANDS, defaultBranding, resolveBranding } from "../brands.js";
import { formatStartupClean } from "../format.js";
import { formatDenyMessage } from "../guard.js";
import { formatStatusLine } from "../statusline.js";
import type { Branding, Logger, Verdict } from "../types.js";

describe("defaultBranding", () => {
	it("has correct defaults", () => {
		expect(defaultBranding.name).toBe("Sage");
		expect(defaultBranding.short_name).toBe("Sage");
		expect(defaultBranding.brand_key).toBeUndefined();
	});
});

describe("BRANDS registry", () => {
	it("contains norton", () => {
		const norton = BRANDS.norton;
		expect(norton).toBeDefined();
		expect(norton?.name).toBe("Norton AI Agent Protection");
		expect(norton?.short_name).toBe("Norton");
	});
});

describe("resolveBranding", () => {
	it("returns defaults for undefined brand_key", () => {
		const branding = resolveBranding(undefined);
		expect(branding.name).toBe("Sage");
		expect(branding.short_name).toBe("Sage");
		expect(branding.brand_key).toBeUndefined();
	});

	it("resolves norton brand", () => {
		const branding = resolveBranding("norton");
		expect(branding.name).toBe("Norton AI Agent Protection");
		expect(branding.short_name).toBe("Norton");
		expect(branding.brand_key).toBe("norton");
	});

	it("returns defaults for unknown brand_key (fail-open)", () => {
		const branding = resolveBranding("nonexistent");
		expect(branding.name).toBe("Sage");
		expect(branding.short_name).toBe("Sage");
		expect(branding.brand_key).toBeUndefined();
	});

	it("logs warning for unknown brand_key", () => {
		const warnings: string[] = [];
		const noop = () => {};
		const logger: Logger = {
			debug: noop,
			info: noop,
			error: noop,
			warn: (msg: string) => warnings.push(msg),
		};
		resolveBranding("unknown-brand", logger);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("unknown-brand");
	});
});

// ── Format functions with custom branding ──────────────────────────

const customBranding: Branding = {
	name: "Norton AI Agent Protection",
	short_name: "Norton",
	brand_key: "norton",
};

describe("format functions with custom branding", () => {
	it("formatStartupClean uses name", () => {
		const msg = formatStartupClean("1.0.0", null, customBranding);
		expect(msg).toContain("Norton AI Agent Protection");
		expect(msg).not.toContain("🛡️ Sage ");
	});

	it("formatStatusLine uses name (clean)", () => {
		const msg = formatStatusLine(0, 0, null, null, customBranding);
		expect(msg).toBe("🛡️ Norton AI Agent Protection: ✅");
	});

	it("formatStatusLine uses name (with detections)", () => {
		const msg = formatStatusLine(2, 1, "Malware detected", "malware", customBranding);
		expect(msg).toContain("Norton AI Agent Protection:");
		expect(msg).toContain("2 blocked");
		expect(msg).toContain("1 flagged");
	});

	it("formatDenyMessage uses name", () => {
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
		expect(msg).toContain("Norton AI Agent Protection blocked this action.");
		expect(msg).not.toMatch(/^Sage blocked/);
	});
});
