/**
 * Load and validate YAML-based threat definitions.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { getFileContent } from "./file-utils.js";
import type { Logger, Threat } from "./types.js";
import { nullLogger } from "./types.js";

const REQUIRED_FIELDS = new Set([
	"id",
	"category",
	"severity",
	"confidence",
	"pattern",
	"match_on",
	"title",
]);

function parseExpiresAt(value: string | null | undefined): Date | null {
	if (value == null) return null;
	try {
		const date = new Date(String(value));
		return Number.isNaN(date.getTime()) ? null : date;
	} catch {
		return null;
	}
}

function isExpired(entry: Record<string, unknown>): boolean {
	const expiresAt = parseExpiresAt(entry.expires_at as string | null | undefined);
	if (expiresAt === null) return false;
	return Date.now() > expiresAt.getTime();
}

export async function loadThreats(
	threatDir: string,
	logger: Logger = nullLogger,
): Promise<Threat[]> {
	const threats: Threat[] = [];

	let files: string[];
	try {
		files = (await readdir(threatDir)).filter((f) => f.endsWith(".yaml")).sort();
	} catch {
		logger.warn("Threat directory does not exist or is unreadable", { path: threatDir });
		return threats;
	}

	for (const filename of files) {
		const filePath = join(threatDir, filename);
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
			const keys = new Set(Object.keys(record));
			const missing = [...REQUIRED_FIELDS].filter((f) => !keys.has(f));
			if (missing.length > 0) {
				logger.warn(`Skipping threat in ${filename}: missing fields ${missing.join(", ")}`);
				continue;
			}

			if (record.revoked === true) continue;
			if (isExpired(record)) continue;

			let compiledPattern: RegExp;
			try {
				const flags = record.case_insensitive === true ? "i" : "";
				compiledPattern = new RegExp(record.pattern as string, flags);
			} catch (e) {
				logger.warn(`Skipping threat ${record.id}: invalid regex pattern`, {
					error: String(e),
				});
				continue;
			}

			// Normalize match_on to Set
			const rawMatchOn = record.match_on;
			const matchOn: Set<string> = new Set(
				Array.isArray(rawMatchOn) ? rawMatchOn : [rawMatchOn as string],
			);

			const rawFlags = record.flags;
			const flags: string[] = Array.isArray(rawFlags) ? rawFlags : [];

			const confidence = Number(record.confidence);
			if (!Number.isFinite(confidence) || confidence <= 0 || confidence > 1) {
				logger.warn(`Skipping threat ${record.id}: invalid confidence value`, {
					confidence: record.confidence,
				});
				continue;
			}

			threats.push({
				id: record.id as string,
				version: typeof record.version === "number" ? record.version : undefined,
				category: record.category as string,
				severity: record.severity as Threat["severity"],
				confidence,
				pattern: record.pattern as string,
				compiledPattern,
				matchOn,
				title: record.title as string,
				expiresAt: parseExpiresAt(record.expires_at as string | null | undefined),
				revoked: false,
				flags,
			});
		}
	}

	logger.debug(`Loaded ${threats.length} threats from ${threatDir}`);
	return threats;
}
