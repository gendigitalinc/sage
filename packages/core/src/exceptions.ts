/**
 * Exception rules — pattern-based allow/deny rules evaluated in the pipeline
 * before heuristics and reputation checks (deny first, then allow).
 * Loaded from ~/.sage/exceptions.json.
 */

import { createHash } from "node:crypto";
import { normalize, sep } from "node:path";
import { resolvePath } from "./config.js";
import { atomicWriteJson, getFileContent, getHomeDir } from "./file-utils.js";
import { extractDomain, isTrustedDomain } from "./trusted-domains.js";
import type { Artifact, ExceptionRule, ExceptionsConfig, Logger } from "./types.js";
import { ExceptionsFileSchema, nullLogger } from "./types.js";

const MAX_RULES_WARNING = 100;
const REGEX_TIMEOUT_MS = 50;

// ── Rule ID computation ────────────────────────────────────────────

export function computeRuleId(decision: string, match: string, pattern: string): string {
	const hash = createHash("sha256").update(`${decision}:${match}:${pattern}`).digest("hex");
	return hash.slice(0, 8);
}

// ── Loading & normalization ────────────────────────────────────────

export async function loadExceptions(
	config: ExceptionsConfig,
	logger: Logger = nullLogger,
): Promise<ExceptionRule[]> {
	const path = resolvePath(config.path);

	let raw: string;
	try {
		raw = await getFileContent(path);
	} catch {
		return [];
	}

	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch (e) {
		logger.warn(`Failed to parse exceptions from ${path}`, { error: String(e) });
		return [];
	}

	let parsed: {
		rules: Array<{
			id?: string;
			decision: string;
			match: string;
			pattern: string;
			reason?: string;
		}>;
	};
	try {
		parsed = ExceptionsFileSchema.parse(data);
	} catch (e) {
		logger.warn(`Exceptions validation failed for ${path}`, { error: String(e) });
		return [];
	}

	if (parsed.rules.length > MAX_RULES_WARNING) {
		logger.warn(`Exceptions file has ${parsed.rules.length} rules (>${MAX_RULES_WARNING})`, {
			path,
		});
	}

	// Deduplicate by computed ID (first occurrence wins)
	const seen = new Map<string, ExceptionRule>();
	let needsWrite = false;

	for (const rule of parsed.rules) {
		const expectedId = computeRuleId(rule.decision, rule.match, rule.pattern);

		if (rule.id !== expectedId) {
			needsWrite = true;
		}

		if (seen.has(expectedId)) {
			needsWrite = true;
			continue;
		}

		const normalized: ExceptionRule = {
			id: expectedId,
			decision: rule.decision as ExceptionRule["decision"],
			match: rule.match as ExceptionRule["match"],
			pattern: rule.pattern,
			...(rule.reason !== undefined ? { reason: rule.reason } : {}),
		};

		seen.set(expectedId, normalized);
	}

	const rules = [...seen.values()];

	if (needsWrite) {
		try {
			await atomicWriteJson(path, {
				rules: rules.map((r) => ({
					id: r.id,
					decision: r.decision,
					match: r.match,
					pattern: r.pattern,
					...(r.reason !== undefined ? { reason: r.reason } : {}),
				})),
			});
		} catch (e) {
			logger.warn(`Failed to write normalized exceptions to ${path}`, { error: String(e) });
		}
	}

	// Pre-compile regex patterns to catch errors early
	for (const rule of rules) {
		if (rule.match === "regex") {
			try {
				new RegExp(rule.pattern);
			} catch (e) {
				logger.warn(`Invalid regex in exception rule ${rule.id}: ${rule.pattern}`, {
					error: String(e),
				});
			}
		}
	}

	return rules;
}

// ── Adding exceptions programmatically ────────────────────────────

function escapeRegexString(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Add an exception rule for an artifact. Used by the native "allow-always"
 * approval flow — NOT exposed as a tool to agents.
 *
 * @param exceptionsPath — direct path to exceptions.json; when omitted,
 *   resolved from config.json via loadConfig().
 */
export async function addException(
	artifact: { type: "url" | "command" | "file_path"; value: string },
	reason: string,
	exceptionsPath?: string,
	logger: Logger = nullLogger,
): Promise<void> {
	let excConfig: ExceptionsConfig;
	if (exceptionsPath) {
		excConfig = { path: exceptionsPath };
	} else {
		const config = await import("./config.js").then((m) => m.loadConfig(undefined, logger));
		excConfig = config.exceptions;
	}

	const pattern = `^${escapeRegexString(artifact.value)}$`;
	const rule: ExceptionRule = {
		id: computeRuleId("allow", "regex", pattern),
		decision: "allow",
		match: "regex",
		pattern,
		reason,
	};

	const existing = await loadExceptions(excConfig, logger);

	// Dedup: skip if rule with same ID already exists
	if (existing.some((r) => r.id === rule.id)) {
		logger.debug("Exception rule already exists", {
			ruleId: rule.id,
			decision: rule.decision,
			match: rule.match,
		});
		return;
	}

	const rules = [...existing, rule];
	const path = resolvePath(excConfig.path);

	try {
		await atomicWriteJson(path, {
			rules: rules.map((r) => ({
				id: r.id,
				decision: r.decision,
				match: r.match,
				pattern: r.pattern,
				...(r.reason !== undefined ? { reason: r.reason } : {}),
			})),
		});
		logger.info("Exception rule added", {
			ruleId: rule.id,
			decision: rule.decision,
			match: rule.match,
		});
	} catch (e) {
		logger.warn("Failed to write exception rule", { error: String(e) });
	}
}

// ── Matching functions ─────────────────────────────────────────────

/**
 * Shell metacharacters that indicate a compound/composed command.
 * Uses an allowlist-of-safe-tokens approach: if any token contains these,
 * the executable match bails out.
 */
const UNSAFE_COMMAND_PATTERN = /[;&|`]|\$\(|<\(|>\(|\n|\r/;

/**
 * Sudo flags that take an argument (the next token is not the command).
 */
const SUDO_FLAGS_WITH_ARG = new Set(["-u", "-g", "-C", "-D", "-R", "-T", "-h", "-p"]);

export function matchesExecutable(pattern: string, command: string): boolean {
	if (UNSAFE_COMMAND_PATTERN.test(command)) {
		return false;
	}

	const tokens = command.trim().split(/\s+/);
	if (tokens.length === 0) return false;

	let i = 0;

	// Strip sudo wrapper
	if (tokens[i] === "sudo") {
		i++;
		while (i < tokens.length) {
			const token = tokens[i];
			if (token === undefined || token === "--") {
				if (token === "--") i++;
				break;
			}
			if (!token.startsWith("-")) break;
			i++;
			const nextToken = tokens[i];
			if (SUDO_FLAGS_WITH_ARG.has(token) && nextToken !== undefined && !nextToken.startsWith("-")) {
				i++;
			}
		}
	}

	// Strip env wrapper
	if (i < tokens.length && tokens[i] === "env") {
		i++;
		while (i < tokens.length) {
			const tok = tokens[i];
			if (tok === undefined || !/^\w+=/.test(tok)) break;
			i++;
		}
	}

	const exeToken = tokens[i];
	if (exeToken === undefined) return false;

	// Strip path prefix from executable (e.g., /usr/bin/rm → rm)
	const exeParts = exeToken.split("/");
	const exeName = exeParts[exeParts.length - 1];
	if (!exeName) return false;

	const patternTokens = pattern.trim().split(/\s+/);
	if (patternTokens.length === 0) return false;

	// Match first token (executable name)
	if (exeName !== patternTokens[0]) return false;

	// Match remaining pattern tokens against command tokens (prefix match)
	for (let j = 1; j < patternTokens.length; j++) {
		if (i + j >= tokens.length) return false;
		if (tokens[i + j] !== patternTokens[j]) return false;
	}

	return true;
}

export function matchesDomain(pattern: string, url: string): boolean {
	const domain = extractDomain(url);
	if (!domain) return false;

	// Check if pattern includes a port constraint
	const portMatch = pattern.match(/^(.+):(\d+)$/);
	const portDomain = portMatch?.[1];
	const portPort = portMatch?.[2];
	if (portDomain && portPort) {
		const patternDomain = portDomain.toLowerCase();
		const patternPort = portPort;

		let urlPort: string;
		try {
			const parsed = new URL(url);
			urlPort = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
		} catch {
			return false;
		}

		if (urlPort !== patternPort) return false;

		return isTrustedDomain(domain, [{ domain: patternDomain, reason: "" }]);
	}

	return isTrustedDomain(domain, [{ domain: pattern.toLowerCase(), reason: "" }]);
}

/** Expand ~ in a pattern and normalize path separators. */
function normalizePatternPath(pattern: string): string {
	const home = getHomeDir();
	const expanded =
		pattern.startsWith("~/") || pattern === "~" ? `${home}${pattern.slice(1)}` : pattern;
	return normalize(expanded);
}

export function matchesPath(pattern: string, filePath: string): boolean {
	const hasWildcard = pattern.includes("*");

	if (hasWildcard) {
		return globMatch(normalizePatternPath(pattern), normalizePatternPath(filePath));
	}

	// Prefix match with path-separator awareness
	const normalizedPattern = normalizePatternPath(pattern);
	const normalizedPath = normalizePatternPath(filePath);

	if (normalizedPath === normalizedPattern) return true;
	if (normalizedPath.startsWith(normalizedPattern + sep)) return true;

	return false;
}

export function matchesPlugin(pattern: string, pluginKey: string): boolean {
	const hasWildcard = pattern.includes("*");

	if (hasWildcard) {
		return globMatch(pattern, pluginKey);
	}

	// Name-prefix match with @-boundary awareness
	if (pluginKey === pattern) return true;
	if (pluginKey.startsWith(pattern) && pluginKey[pattern.length] === "@") return true;

	return false;
}

export function matchesRegex(pattern: string, value: string): boolean {
	let re: RegExp;
	try {
		re = new RegExp(pattern);
	} catch {
		return false;
	}

	// Timeout protection against ReDoS
	const start = performance.now();
	try {
		const result = re.test(value);
		if (performance.now() - start > REGEX_TIMEOUT_MS) {
			return false;
		}
		return result;
	} catch {
		return false;
	}
}

// ── Glob matcher ───────────────────────────────────────────────────

/**
 * Simple glob matching: converts a glob pattern to a regex.
 * Supports `*` (any non-separator chars) and `**` (any chars including separators).
 */
function globMatch(pattern: string, value: string): boolean {
	// Normalize separators to / for matching
	const normPattern = pattern.replace(/\\/g, "/");
	const normValue = value.replace(/\\/g, "/");

	const regexStr = globToRegex(normPattern);
	try {
		const re = new RegExp(`^${regexStr}$`);
		return re.test(normValue);
	} catch {
		return false;
	}
}

function globToRegex(pattern: string): string {
	let result = "";
	let i = 0;
	while (i < pattern.length) {
		const ch = pattern[i];
		if (ch === undefined) break;
		if (ch === "*" && pattern[i + 1] === "*") {
			result += ".*";
			i += 2;
			if (i < pattern.length && pattern[i] === "/") i++;
		} else if (ch === "*") {
			result += "[^/]*";
			i++;
		} else if (ch === "?") {
			result += "[^/]";
			i++;
		} else {
			result += escapeRegex(ch);
			i++;
		}
	}
	return result;
}

function escapeRegex(char: string): string {
	return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Pipeline helpers ───────────────────────────────────────────────

export interface DenyExceptionMatch {
	rule: ExceptionRule;
	artifact: Artifact;
}

/**
 * Find the first deny exception that matches any artifact.
 * Returns the matched rule and artifact, or null.
 */
export function findDenyException(
	rules: ExceptionRule[],
	artifacts: Artifact[],
): DenyExceptionMatch | null {
	const denyRules = rules.filter((r) => r.decision === "deny");

	for (const artifact of artifacts) {
		for (const rule of denyRules) {
			if (matchesArtifact(rule, artifact)) {
				return { rule, artifact };
			}
		}
	}

	return null;
}

/**
 * Check if allow exceptions fully cover the artifacts (match-type-aware semantics).
 * Returns the matched rule, or null.
 */
export function findAllowException(
	rules: ExceptionRule[],
	artifacts: Artifact[],
): ExceptionRule | null {
	const allowRules = rules.filter((r) => r.decision === "allow");

	// executable: any command artifact match → short-circuit allow
	const execRules = allowRules.filter((r) => r.match === "executable");
	if (execRules.length > 0) {
		for (const artifact of artifacts) {
			if (artifact.type !== "command") continue;
			const match = execRules.find((r) => matchesExecutable(r.pattern, artifact.value));
			if (match) return match;
		}
	}

	// path: any file_path artifact match → short-circuit allow
	const pathRules = allowRules.filter((r) => r.match === "path");
	if (pathRules.length > 0) {
		for (const artifact of artifacts) {
			if (artifact.type !== "file_path") continue;
			const match = pathRules.find((r) => matchesPath(r.pattern, artifact.value));
			if (match) return match;
		}
	}

	// domain: only when ALL artifacts are URLs and ALL match
	const domainRules = allowRules.filter((r) => r.match === "domain");
	const firstDomainRule = domainRules[0];
	if (firstDomainRule && artifacts.length > 0 && artifacts.every((a) => a.type === "url")) {
		if (artifacts.every((a) => domainRules.some((r) => matchesDomain(r.pattern, a.value)))) {
			return firstDomainRule;
		}
	}

	// regex: most restrictive — ALL artifacts must match
	const regexRules = allowRules.filter((r) => r.match === "regex");
	const firstRegexRule = regexRules[0];
	if (firstRegexRule && artifacts.length > 0) {
		if (artifacts.every((a) => regexRules.some((r) => matchesRegex(r.pattern, a.value)))) {
			return firstRegexRule;
		}
	}

	return null;
}

// ── Plugin exception helpers (session-start-scan) ──────────────────

export function findPluginDenyException(
	rules: ExceptionRule[],
	pluginKey: string,
): ExceptionRule | null {
	const found = rules.find(
		(r) => r.decision === "deny" && r.match === "plugin" && matchesPlugin(r.pattern, pluginKey),
	);
	return found ?? null;
}

export function findPluginAllowException(
	rules: ExceptionRule[],
	pluginKey: string,
): ExceptionRule | null {
	const found = rules.find(
		(r) => r.decision === "allow" && r.match === "plugin" && matchesPlugin(r.pattern, pluginKey),
	);
	return found ?? null;
}

// ── Internal helpers ───────────────────────────────────────────────

function matchesArtifact(rule: ExceptionRule, artifact: Artifact): boolean {
	switch (rule.match) {
		case "executable":
			return artifact.type === "command" && matchesExecutable(rule.pattern, artifact.value);
		case "domain":
			return artifact.type === "url" && matchesDomain(rule.pattern, artifact.value);
		case "path":
			return artifact.type === "file_path" && matchesPath(rule.pattern, artifact.value);
		case "regex":
			return matchesRegex(rule.pattern, artifact.value);
		case "plugin":
			// plugin match type is only for session-start scanning, not tool-call evaluation
			return false;
	}
}
