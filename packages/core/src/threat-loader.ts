/**
 * Load and validate YAML-based threat definitions.
 */

import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { resolvePath, SAGE_DIR } from "./config.js";
import { isCanonicalDetectionName } from "./detection-names.js";
import { getFileContent } from "./file-utils.js";
import type { Logger, Threat } from "./types.js";
import { nullLogger } from "./types.js";

/** Maximum number of bundled and custom rules loaded in one process. */
const MAX_THREAT_RULES = 10_000;

export interface LoadThreatsOptions {
	/** Optional user-owned directory, loaded after the bundled rules. */
	customThreatsDir?: string;
	/** Emit one info log per successfully loaded custom rule. */
	logCustomRuleIds?: boolean;
}

/** The persistent, user-owned directory for custom threat definitions. */
export function getUserThreatsDir(sageDirPath?: string): string {
	return join(resolvePath(sageDirPath ?? SAGE_DIR), "threats");
}

const REQUIRED_FIELDS = new Set([
	"id",
	"version",
	"detection_name",
	"category",
	"severity",
	"confidence",
	"pattern",
	"match_on",
	"title",
]);

/**
 * The one filename in a threat directory that holds shared pattern vocabulary
 * instead of rules. Reserving a single name rather than a `_*` glob keeps the
 * collision surface at one string: any other file must be a rule list, so a
 * mapping found elsewhere is still reported instead of silently accepted.
 */
const MACRO_FILENAME = "_macros.yaml";

/** Depth of nested `{{MACRO}}` references resolved before giving up. */
const MAX_MACRO_PASSES = 5;

const MACRO_REF = /\{\{([A-Z0-9_]+)\}\}/g;

/**
 * Substitute `{{NAME}}` references from the shared vocabulary. Macros may
 * reference other macros; resolution stops once no references remain.
 *
 * @throws if a referenced macro is undefined or nests deeper than
 * {@link MAX_MACRO_PASSES}, so the caller can skip the rule loudly rather than
 * compile a pattern that silently never matches.
 */
export function expandMacros(pattern: string, macros: Record<string, string>): string {
	let expanded = pattern;
	for (let pass = 0; pass <= MAX_MACRO_PASSES; pass++) {
		if (!expanded.includes("{{")) return expanded;
		if (pass === MAX_MACRO_PASSES) {
			throw new Error(`macro nesting exceeds ${MAX_MACRO_PASSES} passes`);
		}
		expanded = expanded.replace(MACRO_REF, (_match, name: string) => {
			const value = macros[name];
			if (value === undefined) throw new Error(`undefined macro {{${name}}}`);
			return value;
		});
	}
	return expanded;
}

/** Read `{{NAME}}` definitions from the vocabulary file's mapping. */
function readMacros(
	filename: string,
	data: Record<string, unknown>,
	logger: Logger,
): Record<string, string> {
	const macros: Record<string, string> = {};

	for (const [name, value] of Object.entries(data)) {
		if (typeof value !== "string") {
			logger.warn(`Skipping macro ${name} in ${filename}: not a string`);
			continue;
		}
		macros[name] = value;
	}

	return macros;
}

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

async function loadThreatDirectory(
	threatDir: string,
	logger: Logger,
	{
		custom = false,
		customThreatIds = new Set<string>(),
		bundledThreatIds = new Set<string>(),
		maxRules = MAX_THREAT_RULES,
		logCustomRuleIds = false,
		optional = false,
	}: {
		custom?: boolean;
		customThreatIds?: Set<string>;
		bundledThreatIds?: Set<string>;
		maxRules?: number;
		logCustomRuleIds?: boolean;
		optional?: boolean;
	} = {},
): Promise<Threat[]> {
	const threats: Threat[] = [];

	let files: string[];
	try {
		files = (await readdir(threatDir)).filter((f) => f.endsWith(".yaml")).sort();
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (optional && code === "ENOENT") {
			logger.debug("Custom threat directory does not exist", { path: threatDir });
			return threats;
		}
		logger.warn("Threat directory does not exist or is unreadable", {
			path: threatDir,
			error: String(error),
		});
		return threats;
	}

	const ruleFiles: { filename: string; data: unknown[] }[] = [];
	let macros: Record<string, string> = {};

	for (const filename of files) {
		let content: string;
		try {
			content = await getFileContent(join(threatDir, filename));
		} catch (e) {
			logger.warn(`Failed to read ${filename}`, { error: String(e) });
			continue;
		}

		// Kept separate from the read above so an invalid file is diagnosable:
		// a syntax error must not be reported as an I/O failure.
		let data: unknown;
		try {
			data = parseYaml(content);
		} catch (e) {
			logger.warn(`Failed to parse ${filename}`, { error: String(e) });
			continue;
		}

		if (filename === MACRO_FILENAME) {
			if (typeof data !== "object" || data === null || Array.isArray(data)) {
				logger.warn(
					`Expected mapping in ${filename}, got ${Array.isArray(data) ? "list" : typeof data}`,
				);
				continue;
			}
			macros = readMacros(filename, data as Record<string, unknown>, logger);
			continue;
		}

		if (!Array.isArray(data)) {
			logger.warn(`Expected list in ${filename}, got ${typeof data}`);
			continue;
		}

		ruleFiles.push({ filename, data });
	}

	ruleFilesLoop: for (const { filename, data } of ruleFiles) {
		for (const entry of data) {
			if (threats.length >= maxRules) {
				logger.warn("Threat rule limit reached; ignoring remaining rules", {
					path: threatDir,
					maxRules: MAX_THREAT_RULES,
				});
				break ruleFilesLoop;
			}

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

			if (typeof record.id !== "string" || record.id.length === 0) {
				logger.warn(`Skipping threat in ${filename}: invalid id`, { id: record.id });
				continue;
			}

			if (custom && customThreatIds.has(record.id)) {
				logger.warn(
					bundledThreatIds.has(record.id)
						? `Skipping custom threat ${record.id}: id conflicts with a bundled rule`
						: `Skipping custom threat ${record.id}: duplicate custom rule id`,
					{ id: record.id, path: join(threatDir, filename) },
				);
				continue;
			}

			if (record.revoked === true) continue;
			if (isExpired(record)) continue;

			let pattern: string;
			let compiledPattern: RegExp;
			try {
				pattern = expandMacros(record.pattern as string, macros);
				const flags = record.case_insensitive === true ? "i" : "";
				compiledPattern = new RegExp(pattern, flags);
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

			const version = record.version;
			if (typeof version !== "number" || !Number.isInteger(version) || version <= 0) {
				logger.warn(`Skipping threat ${record.id}: invalid version`, {
					version,
				});
				continue;
			}

			// YAML uses snake_case; normalize at this file-format boundary.
			const detectionName = record.detection_name;
			if (typeof detectionName !== "string" || !isCanonicalDetectionName(detectionName)) {
				logger.warn(`Skipping threat ${record.id}: invalid detection_name`, {
					detectionName,
				});
				continue;
			}

			const threat: Threat = {
				id: record.id,
				version,
				detectionName,
				category: record.category as string,
				severity: record.severity as Threat["severity"],
				confidence,
				pattern,
				compiledPattern,
				matchOn,
				title: record.title as string,
				expiresAt: parseExpiresAt(record.expires_at as string | null | undefined),
				revoked: false,
				flags,
				customRule: custom,
			};
			threats.push(threat);
			if (custom) {
				customThreatIds.add(threat.id);
				if (logCustomRuleIds) {
					logger.info("Loaded custom threat rule", {
						id: threat.id,
						path: join(threatDir, filename),
					});
				}
			}
		}
	}

	logger.debug(`Loaded ${threats.length} threats from ${threatDir}`);
	return threats;
}

/**
 * Load bundled rules first, followed by optional user-owned rules. Bundled IDs
 * always win, and custom IDs are deduplicated so a local file cannot shadow a
 * bundled rule or an earlier custom definition.
 */
export async function loadThreats(
	threatDir: string,
	logger: Logger = nullLogger,
	options: LoadThreatsOptions = {},
): Promise<Threat[]> {
	const bundledThreats = await loadThreatDirectory(threatDir, logger);
	if (!options.customThreatsDir || resolve(options.customThreatsDir) === resolve(threatDir)) {
		return bundledThreats;
	}

	const bundledThreatIds = new Set(bundledThreats.map((threat) => threat.id));
	const customThreatIds = new Set(bundledThreatIds);
	const customThreats = await loadThreatDirectory(options.customThreatsDir, logger, {
		custom: true,
		customThreatIds,
		bundledThreatIds,
		maxRules: Math.max(0, MAX_THREAT_RULES - bundledThreats.length),
		logCustomRuleIds: options.logCustomRuleIds,
		optional: true,
	});

	return [...bundledThreats, ...customThreats];
}
