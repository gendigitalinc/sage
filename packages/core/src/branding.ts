/**
 * Branding loader for Sage.
 * Loads white-label settings from ~/.sage/branding.json with full defaults fallback.
 */

import { join } from "node:path";
import { resolvePath, SAGE_DIR } from "./config.js";
import { getFileContent, getFileContentSync } from "./file-utils.js";
import type { Branding, Logger } from "./types.js";
import { BrandingSchema, nullLogger } from "./types.js";

export const defaultBranding: Branding = BrandingSchema.parse({});

function defaultBrandingPath(): string {
	return join(resolvePath(SAGE_DIR), "branding.json");
}

export async function loadBranding(
	logger: Logger = nullLogger,
	brandingPath?: string,
): Promise<Branding> {
	const path = brandingPath ?? defaultBrandingPath();

	let raw: string;
	try {
		raw = await getFileContent(path);
	} catch {
		return defaultBranding;
	}

	return parseBranding(raw, path, logger);
}

export function loadBrandingSync(logger: Logger = nullLogger, brandingPath?: string): Branding {
	const path = brandingPath ?? defaultBrandingPath();

	let raw: string;
	try {
		raw = getFileContentSync(path);
	} catch {
		return defaultBranding;
	}

	return parseBranding(raw, path, logger);
}

function parseBranding(raw: string, path: string, logger: Logger): Branding {
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch (e) {
		logger.warn(`Failed to parse branding from ${path}`, { error: String(e) });
		return defaultBranding;
	}

	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		logger.warn(`Branding file ${path} does not contain a JSON object`);
		return defaultBranding;
	}

	try {
		return BrandingSchema.parse(data);
	} catch (e) {
		logger.warn("Branding validation failed, using defaults", { error: String(e) });
		return defaultBranding;
	}
}
