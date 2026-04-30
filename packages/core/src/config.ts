/**
 * Configuration loader for Sage.
 * Loads settings from ~/.sage/config.json with full defaults fallback.
 */

import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { getFileContent, getFileContentSync, getHomeDir } from "./file-utils.js";
import type { Config, Logger } from "./types.js";
import { ConfigSchema, nullLogger } from "./types.js";

export const SAGE_DIR = "~/.sage";

/** Hook timeout in seconds, shared across all connector hook installers. */
export const HOOK_TIMEOUT_SECONDS = 8;

function resolvedSageDir(): string {
	return resolvePath(SAGE_DIR);
}

function defaultConfigPath(): string {
	return join(resolvedSageDir(), "config.json");
}

function defaultCachePath(): string {
	return join(resolvedSageDir(), "cache.json");
}

function defaultAllowlistPath(): string {
	return join(resolvedSageDir(), "allowlist.json");
}

function defaultExceptionsPath(): string {
	return join(resolvedSageDir(), "exceptions.json");
}

function defaultAuditPath(): string {
	return join(resolvedSageDir(), "audit.jsonl");
}

/** Expand ~ to the user's home directory. Prefers HOME env over os.homedir(). */
export function resolvePath(pathStr: string): string {
	if (pathStr.startsWith("~/") || pathStr === "~") {
		const home = getHomeDir();
		return join(home, pathStr.slice(1));
	}
	return pathStr;
}

function isWithinDirectory(baseDir: string, targetPath: string): boolean {
	const rel = relative(baseDir, targetPath);
	if (rel === "") return true;
	if (isAbsolute(rel)) return false;
	return rel !== ".." && !rel.startsWith(`..${sep}`);
}

function normalizeStateFilePath(
	configuredPath: string,
	fallbackPath: string,
	field: "cache" | "allowlist" | "exceptions" | "logging",
	logger: Logger,
): string {
	const sageDir = resolvedSageDir();
	const trimmed = configuredPath.trim();
	if (trimmed === "") {
		logger.warn(`Config ${field}.path is empty; using default`, {
			configuredPath,
			defaultPath: fallbackPath,
		});
		return fallbackPath;
	}

	const expanded = resolvePath(trimmed);
	const resolved = isAbsolute(expanded) ? resolve(expanded) : resolve(sageDir, expanded);
	if (isWithinDirectory(sageDir, resolved)) {
		if (resolved === sageDir) {
			logger.warn(`Config ${field}.path must point to a file; using default`, {
				configuredPath,
				defaultPath: fallbackPath,
			});
			return fallbackPath;
		}
		return resolved;
	}

	logger.warn(`Config ${field}.path escapes ${sageDir}; using default`, {
		configuredPath,
		defaultPath: fallbackPath,
	});
	return fallbackPath;
}

const BRAND_KEY_RE = /^[a-z0-9_-]+$/u;

function sanitizeBrandKey(data: Record<string, unknown>, logger: Logger): Record<string, unknown> {
	const brandKey = data.brand_key;
	if (brandKey === undefined) return data;
	if (
		typeof brandKey === "string" &&
		brandKey.length >= 1 &&
		brandKey.length <= 32 &&
		BRAND_KEY_RE.test(brandKey)
	) {
		return data;
	}
	logger.warn(`Invalid brand_key in config — ignoring`, { brand_key: brandKey });
	const { brand_key: _, ...rest } = data;
	return rest;
}

function sanitizeConfigPaths(config: Config, logger: Logger): Config {
	const cachePath = defaultCachePath();
	const allowlistPath = defaultAllowlistPath();
	const exceptionsPath = defaultExceptionsPath();
	const auditPath = defaultAuditPath();
	return {
		...config,
		cache: {
			...config.cache,
			path: normalizeStateFilePath(config.cache.path, cachePath, "cache", logger),
		},
		allowlist: {
			...config.allowlist,
			path: normalizeStateFilePath(config.allowlist.path, allowlistPath, "allowlist", logger),
		},
		exceptions: {
			...config.exceptions,
			path: normalizeStateFilePath(config.exceptions.path, exceptionsPath, "exceptions", logger),
		},
		logging: {
			...config.logging,
			path: normalizeStateFilePath(config.logging.path, auditPath, "logging", logger),
		},
	};
}

export async function loadConfig(
	configPath?: string,
	logger: Logger = nullLogger,
): Promise<Config> {
	const path = configPath ?? defaultConfigPath();

	let raw: string;
	try {
		raw = await getFileContent(path);
	} catch {
		// Missing file → full defaults (fail-open)
		return sanitizeConfigPaths(ConfigSchema.parse({}), logger);
	}

	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch (e) {
		logger.warn(`Failed to parse config from ${path}`, { error: String(e) });
		return sanitizeConfigPaths(ConfigSchema.parse({}), logger);
	}

	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		logger.warn(`Config file ${path} does not contain a JSON object`);
		return sanitizeConfigPaths(ConfigSchema.parse({}), logger);
	}

	const sanitized = sanitizeBrandKey(data as Record<string, unknown>, logger);

	try {
		return sanitizeConfigPaths(ConfigSchema.parse(sanitized), logger);
	} catch (e) {
		logger.warn(`Config validation failed, using defaults`, { error: String(e) });
		return sanitizeConfigPaths(ConfigSchema.parse({}), logger);
	}
}

/**
 * Synchronous config loader. Required because branding resolution depends on
 * config, and some callers (OpenClaw plugin registration, extension activation)
 * need branding synchronously before any async init.
 */
export function loadConfigSync(configPath?: string, logger: Logger = nullLogger): Config {
	const path = configPath ?? defaultConfigPath();

	let raw: string;
	try {
		raw = getFileContentSync(path);
	} catch {
		return sanitizeConfigPaths(ConfigSchema.parse({}), logger);
	}

	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch (e) {
		logger.warn(`Failed to parse config from ${path}`, { error: String(e) });
		return sanitizeConfigPaths(ConfigSchema.parse({}), logger);
	}

	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		logger.warn(`Config file ${path} does not contain a JSON object`);
		return sanitizeConfigPaths(ConfigSchema.parse({}), logger);
	}

	const sanitized = sanitizeBrandKey(data as Record<string, unknown>, logger);

	try {
		return sanitizeConfigPaths(ConfigSchema.parse(sanitized), logger);
	} catch (e) {
		logger.warn(`Config validation failed, using defaults`, { error: String(e) });
		return sanitizeConfigPaths(ConfigSchema.parse({}), logger);
	}
}
