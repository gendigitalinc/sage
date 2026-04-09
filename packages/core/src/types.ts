/**
 * Zod schemas and inferred TypeScript types for Sage.
 * Single source of truth for all data structures.
 */

import { z } from "zod";

// ── Logger interface (dependency injection) ─────────────────────────

export interface Logger {
	debug(msg: string, data?: Record<string, unknown>): void;
	info(msg: string, data?: Record<string, unknown>): void;
	warn(msg: string, data?: Record<string, unknown>): void;
	error(msg: string, data?: Record<string, unknown>): void;
}

/** No-op logger for when no logger is provided. */
export const nullLogger: Logger = {
	debug() {},
	info() {},
	warn() {},
	error() {},
};

// ── Artifact ────────────────────────────────────────────────────────

export const ArtifactTypeSchema = z.enum(["url", "command", "file_path", "content"]);

export const ArtifactSchema = z.object({
	type: ArtifactTypeSchema,
	value: z.string(),
	context: z.string().optional(),
});

export type Artifact = z.infer<typeof ArtifactSchema>;

// ── Threat ──────────────────────────────────────────────────────────

export const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export const ActionSchema = z.enum(["block", "require_approval", "log"]);

export const ThreatSchema = z.object({
	id: z.string(),
	version: z.number().int().optional(),
	category: z.string(),
	severity: SeveritySchema,
	confidence: z.number(),
	action: ActionSchema,
	pattern: z.string(),
	match_on: z.union([z.string(), z.array(z.string())]),
	title: z.string(),
	expires_at: z.string().nullable().optional(),
	revoked: z.boolean().optional().default(false),
});

/** Raw threat from YAML (before compilation). */
export type ThreatData = z.infer<typeof ThreatSchema>;

/** Loaded threat with compiled regex and normalized match_on. */
export interface Threat {
	id: string;
	version?: number;
	category: string;
	severity: "critical" | "high" | "medium" | "low";
	confidence: number;
	action: "block" | "require_approval" | "log";
	pattern: string;
	compiledPattern: RegExp;
	matchOn: Set<string>;
	title: string;
	expiresAt: Date | null;
	revoked: boolean;
}

// ── Heuristic match ─────────────────────────────────────────────────

export interface HeuristicMatch {
	threat: Threat;
	artifact: string;
	matchValue: string;
}

// ── URL Check ───────────────────────────────────────────────────────

export interface UrlCheckFinding {
	severityName: string;
	typeName: string;
}

export interface UrlCheckResult {
	url: string;
	isMalicious: boolean;
	detections: string[];
	findings: UrlCheckFinding[];
	flags: string[];
}

// ── Verdict ─────────────────────────────────────────────────────────

export const DecisionSchema = z.enum(["allow", "deny", "ask"]);
export const VerdictSeveritySchema = z.enum(["info", "warning", "critical"]);

export type Decision = z.infer<typeof DecisionSchema>;
export type VerdictSeverity = z.infer<typeof VerdictSeveritySchema>;

export interface Verdict {
	decision: Decision;
	category: string;
	confidence: number;
	severity: VerdictSeverity;
	source: string;
	artifacts: string[];
	matchedThreatId: string | null;
	reasons: string[];
}

// ── Package check ──────────────────────────────────────────────────

export interface PackageCheckResult {
	packageName: string;
	registry: "npm" | "pypi";
	verdict: "clean" | "not_found" | "suspicious_age" | "malicious" | "unknown";
	confidence: number;
	details: string;
	fileCheckSeverity?: string;
	fileSha256?: string;
	fileDetectionNames?: string[];
	ageDays?: number;
}

// ── AMSI Check ─────────────────────────────────────────────────────

export interface AmsiCheckResult {
	content: string;
	contentName: string;
	amsiResult: number;
	isDetected: boolean;
	isBlockedByAdmin: boolean;
}

export interface SignalSources {
	heuristicMatches: HeuristicMatch[];
	urlCheckResults: UrlCheckResult[];
	packageCheckResults?: PackageCheckResult[];
	amsiCheckResults?: AmsiCheckResult[];
}

// ── Audit signal metadata (for FP reporting) ────────────────────────

export interface AuditSignals {
	heuristics?: {
		rule_id: string;
		rule_version?: number;
	}[];
	url_checks?: {
		detection_name: string;
		url: string;
	}[];
	file_checks?: {
		detection_name: string;
		file_sha256: string;
	}[];
	package_checks?: {
		detection_name: string;
		package_name: string;
		package_version?: string;
		package_registry: string;
	}[];
}

// ── Cache ───────────────────────────────────────────────────────────

export interface CachedVerdict {
	verdict: Decision;
	severity: VerdictSeverity;
	reasons: string[];
	source: string;
}

export interface CachedEntry extends CachedVerdict {
	checkedAt: string;
	expiresAt: string;
	sageVersion?: string;
}

export interface CacheStore {
	urls: Record<string, CachedEntry>;
	commands: Record<string, CachedEntry>;
	packages: Record<string, CachedEntry>;
}

// ── Config ──────────────────────────────────────────────────────────

export const SensitivitySchema = z.enum(["paranoid", "balanced", "relaxed"]);

export const UrlCheckConfigSchema = z.object({
	endpoint: z.string().optional(),
	timeout_seconds: z.number().default(5.0),
	enabled: z.boolean().default(true),
});

export const CacheConfigSchema = z.object({
	enabled: z.boolean().default(true),
	ttl_malicious_seconds: z.number().default(3600),
	ttl_clean_seconds: z.number().default(86400),
	path: z.string().default("~/.sage/cache.json"),
});

export const AllowlistConfigSchema = z.object({
	path: z.string().default("~/.sage/allowlist.json"),
});

export const LoggingConfigSchema = z.object({
	enabled: z.boolean().default(true),
	log_clean: z.boolean().default(false),
	path: z.string().default("~/.sage/audit.jsonl"),
	max_bytes: z
		.number()
		.int()
		.min(0)
		.default(5 * 1024 * 1024),
	max_files: z.number().int().min(0).default(3),
});

export const FileCheckConfigSchema = z.object({
	endpoint: z.string().optional(),
	timeout_seconds: z.number().default(5.0),
	enabled: z.boolean().default(true),
});

export const PackageCheckConfigSchema = z.object({
	enabled: z.boolean().default(true),
	timeout_seconds: z.number().default(5.0),
	// v1: all scoped packages (@scope/pkg) are skipped automatically.
	// Future: add private_scopes / public_scopes config for fine-grained control.
});

export const AmsiCheckConfigSchema = z.object({
	enabled: z.boolean().default(true),
});
export type AmsiCheckConfig = z.infer<typeof AmsiCheckConfigSchema>;

// ── Exceptions ─────────────────────────────────────────────────────

export const ExceptionDecisionSchema = z.enum(["allow", "deny"]);
export const ExceptionMatchSchema = z.enum(["executable", "domain", "path", "plugin", "regex"]);

export const ExceptionRuleSchema = z.object({
	id: z.string().optional(),
	decision: ExceptionDecisionSchema,
	match: ExceptionMatchSchema,
	pattern: z.string(),
	reason: z.string().optional(),
});

export const ExceptionsFileSchema = z.object({
	rules: z.array(ExceptionRuleSchema).default([]),
});

export type ExceptionDecision = z.infer<typeof ExceptionDecisionSchema>;
export type ExceptionMatch = z.infer<typeof ExceptionMatchSchema>;
export type ExceptionRule = z.infer<typeof ExceptionRuleSchema> & { id: string };
export type ExceptionsFile = z.infer<typeof ExceptionsFileSchema>;

export const ExceptionsConfigSchema = z.object({
	path: z.string().default("~/.sage/exceptions.json"),
});

export type ExceptionsConfig = z.infer<typeof ExceptionsConfigSchema>;

export const ConfigSchema = z.object({
	url_check: UrlCheckConfigSchema.default({}),
	file_check: FileCheckConfigSchema.default({}),
	package_check: PackageCheckConfigSchema.default({}),
	amsi_check: AmsiCheckConfigSchema.default({}),
	heuristics_enabled: z.boolean().default(true),
	cache: CacheConfigSchema.default({}),
	allowlist: AllowlistConfigSchema.default({}),
	exceptions: ExceptionsConfigSchema.default({}),
	logging: LoggingConfigSchema.default({}),
	sensitivity: SensitivitySchema.default("balanced"),
	disabled_threats: z.array(z.string()).default([]),
	community_iq: z.boolean().default(true),
});

export type UrlCheckConfig = z.infer<typeof UrlCheckConfigSchema>;
export type FileCheckConfig = z.infer<typeof FileCheckConfigSchema>;
export type PackageCheckConfig = z.infer<typeof PackageCheckConfigSchema>;
export type CacheConfig = z.infer<typeof CacheConfigSchema>;
export type AllowlistConfig = z.infer<typeof AllowlistConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

// ── Allowlist ───────────────────────────────────────────────────────

export interface AllowlistEntry {
	addedAt: string;
	reason: string;
	originalVerdict: string;
}

export interface Allowlist {
	urls: Record<string, AllowlistEntry>;
	commands: Record<string, AllowlistEntry>;
	filePaths: Record<string, AllowlistEntry>;
}

// ── Trusted domains ─────────────────────────────────────────────────

export interface TrustedDomain {
	domain: string;
	reason: string;
}

// ── Plugin scanner ──────────────────────────────────────────────────

export interface PluginInfo {
	key: string;
	installPath: string;
	version: string;
	lastUpdated: string;
}

export interface PluginFinding {
	threatId: string;
	title: string;
	severity: string;
	confidence: number;
	action: string;
	artifact: string;
	sourceFile: string;
}

export interface PluginScanResult {
	plugin: PluginInfo;
	findings: PluginFinding[];
}

// ── Plugin scan cache ───────────────────────────────────────────────

export interface CachedPluginScanResult {
	pluginKey: string;
	version: string;
	scannedAt: string;
	findings: PluginFindingData[];
}

export interface PluginFindingData {
	threat_id: string;
	title: string;
	severity: string;
	confidence: number;
	action: string;
	artifact: string;
	source_file: string;
}

export interface PluginScanCache {
	configHash: string;
	entries: Record<string, CachedPluginScanResult>;
}

// ── Branding ───────────────────────────────────────────────────────

const brandString = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[^\p{Cc}]+$/u, "No control characters");

export const BrandingSchema = z
	.object({
		product_name: brandString.default("Sage"),
		banner_text: z
			.string()
			.min(1)
			.max(128)
			.regex(/^[^\p{Cc}]+$/u)
			.optional(),
		brand_key: z
			.string()
			.min(1)
			.max(32)
			.regex(/^[a-z0-9_-]+$/u)
			.optional(),
	})
	.transform((b) => ({
		...b,
		banner_text: b.banner_text ?? b.product_name,
	}));

export type Branding = z.output<typeof BrandingSchema>;

// ── Agent runtime ──────────────────────────────────────────────────

export type AgentRuntime = "claude-code" | "openclaw" | "opencode" | "cursor" | "vscode";

// ── Hook types (FP reporting) ───────────────────────────────────────

export const HookTypeSchema = z.enum([
	"PreToolUse",
	"PostToolUse",
	"SessionStart",
	"GatewayStart",
	"BeforeAgentStart",
	"MessagesTransform",
]);

export type HookType = z.infer<typeof HookTypeSchema>;
