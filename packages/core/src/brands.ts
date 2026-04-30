/**
 * Bundled brand definitions for Sage.
 * AV installers set `brand_key` in ~/.sage/config.json; Sage resolves it here.
 */

import type { Branding, Logger } from "./types.js";

export const defaultBranding: Branding = { name: "Sage", short_name: "Sage" };

export const BRANDS: Record<string, { name: string; short_name: string }> = {
	norton: { name: "Norton AI Agent Protection", short_name: "Norton" },
};

export function resolveBranding(brandKey?: string, logger?: Logger): Branding {
	if (!brandKey) return defaultBranding;

	const entry = BRANDS[brandKey];
	if (!entry) {
		logger?.warn(`Unknown brand_key "${brandKey}" in config — using default branding`);
		return defaultBranding;
	}

	return { ...entry, brand_key: brandKey };
}
