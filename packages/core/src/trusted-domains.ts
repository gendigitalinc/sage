/**
 * Trusted installer domains — suppresses pipe-to-shell false positives.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { getFileContent } from "./file-utils.js";
import type { Logger, TrustedDomain } from "./types.js";
import { nullLogger } from "./types.js";

export async function loadTrustedDomains(
	trustedDomainsDir: string,
	logger: Logger = nullLogger,
): Promise<TrustedDomain[]> {
	let files: string[];
	try {
		files = (await readdir(trustedDomainsDir)).filter((f) => f.endsWith(".yaml")).sort();
	} catch {
		logger.debug("Trusted domains directory does not exist", { path: trustedDomainsDir });
		return [];
	}

	const domains: TrustedDomain[] = [];

	for (const filename of files) {
		const filePath = join(trustedDomainsDir, filename);
		let content: string;
		try {
			content = await getFileContent(filePath);
		} catch (e) {
			logger.warn(`Failed to read ${filename}`, { error: String(e) });
			continue;
		}

		let data: unknown;
		try {
			data = parseYaml(content);
		} catch (e) {
			logger.warn(`Failed to parse ${filename}`, { error: String(e) });
			continue;
		}

		if (!Array.isArray(data)) {
			logger.warn(`Expected list in ${filename}, got ${typeof data}`);
			continue;
		}

		for (const entry of data) {
			if (typeof entry !== "object" || entry === null) {
				logger.warn(`Skipping non-object entry in ${filename}`);
				continue;
			}

			const record = entry as Record<string, unknown>;
			const domain = record.domain;
			const reason = record.reason;

			if (!domain || typeof domain !== "string") {
				logger.warn(`Skipping entry without valid 'domain' in ${filename}`);
				continue;
			}

			if (!reason || typeof reason !== "string") {
				logger.warn(`Skipping entry without valid 'reason' in ${filename}`);
				continue;
			}

			domains.push({ domain: domain.toLowerCase(), reason });
		}
	}

	logger.debug(`Loaded ${domains.length} trusted domains from ${trustedDomainsDir}`);
	return domains;
}

export function extractDomain(url: string): string | null {
	try {
		const parsed = new URL(url);
		return parsed.hostname.toLowerCase() || null;
	} catch {
		return null;
	}
}

export function isTrustedDomain(domain: string, trusted: TrustedDomain[]): boolean {
	const domainLower = domain.toLowerCase();
	for (const td of trusted) {
		if (domainLower === td.domain) return true;
		if (domainLower.endsWith(`.${td.domain}`)) return true;
	}
	return false;
}
