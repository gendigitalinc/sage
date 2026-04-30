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
	/** Medium-risk PI results — for connector-level warning injection. */
	piWarnings?: PiCheckResult[];
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

export type AmsiScanType = "Bash" | "Write" | "Edit" | "ApplyPatch" | "Plugin";

export interface AmsiCheckResult {
	content: string;
	contentName: string;
	amsiResult: number;
	isDetected: boolean;
	isBlockedByAdmin: boolean;
}

// ── PI Check (ML-based prompt-injection) ───────────────────────────

export interface PiCheckResult {
	risk: number;
	/**
	 * Raw snippets of the highest-scoring chunk(s), each capped at roughly
	 * 80 characters. Empty when the score is below the medium-risk floor.
	 * Producer leaves these as raw text; consumers format risk and
	 * structural framing themselves so producer and presentation stay
	 * separated.
	 */
	findings: string[];
	contentName: string;
	/** Model identifier for telemetry (derived from model directory name) */
	modelId: string;
	/** Full highest-scoring chunk (up to 512 tokens) for telemetry. */
	contentSnippet?: string;
}

export interface SignalSources {
	heuristicMatches: HeuristicMatch[];
	urlCheckResults: UrlCheckResult[];
	packageCheckResults?: PackageCheckResult[];
	amsiCheckResults?: AmsiCheckResult[];
	piCheckResults?: PiCheckResult[];
	/** Thresholds for PI check signal classification (from config) */
	piThresholds?: { highRisk: number; mediumRisk: number };
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
	pi_checks?: {
		risk: number;
		model_id: string;
		content_name: string;
		content_snippet?: string;
	}[];
	/**
	 * AMSI scan results. Win32 AMSI returns only a numeric threat level, not a
	 * named detection — so `detection_name` is synthesized from the result code:
	 *   - `"AMSI|DETECTED"`        for `amsi_result >= 0x8000`
	 *   - `"AMSI|BLOCKED_BY_ADMIN"` for `0x4000 <= amsi_result < 0x8000`
	 * (Same convention as `package_checks` synthesizing `"PKG|malicious|..."`.)
	 *
	 * `content_name` identifies what was scanned (e.g. `"Bash:command"`,
	 * `"Write:/path/to/file"`). Home directories are scrubbed by the signal
	 * builder before storage.
	 *
	 * `content_snippet` is a hard-capped (200 char), home-scrubbed slice of the
	 * scanned content. Other signal types carry their own identifying artifact
	 * (`url`, `package_name`); AMSI signals need this snippet to be equivalently
	 * self-contained for FP triage.
	 */
	amsi_checks?: {
		detection_name: string;
		content_name: string;
		content_snippet?: string;
		amsi_result: number;
	}[];
}

// ── Cache ───────────────────────────────────────────────────────────

export interface CachedVerdict {
	verdict: Decision;
	severity: VerdictSeverity;
	reasons: string[];
	source: string;
	/**
	 * URL-cache only: detection labels (e.g. "Phishing:Example") preserved from the
	 * original malicious URL response. Populated by `cacheUrlResults` in the
	 * evaluator for entries with `verdict === "deny"` (possibly as an empty array
	 * if the response carried no detection names). Used to rebuild
	 * `auditSignals.url_checks` on cached deny paths so the FP tool sees the same
	 * signal data as on a live malicious URL response.
	 *
	 * Strictly URL-cache only — `cache.putCommand` and `cache.putPackage` strip
	 * this field on write. Do not populate or read it for command/package entries.
	 */
	urlSignalLabels?: string[];
}

export interface CachedEntry extends CachedVerdict {
	checkedAt: string;
	expiresAt: string;
	sageVersion?: string;
	/** See `CachedVerdict.urlSignalLabels`. URL-cache only. */
	urlSignalLabels?: string[];
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

/**
 * Default risk-score thresholds for ML prompt-injection (PI) detection.
 * Single source of truth — schema defaults, engine fallback, pi-check
 * provider, and the eval script all reference these so they never drift.
 */
export const DEFAULT_PI_HIGH_RISK_THRESHOLD = 0.99;
export const DEFAULT_PI_MEDIUM_RISK_THRESHOLD = 0.5;

export const PiCheckConfigSchema = z.object({
	enabled: z.boolean().default(false),
	max_content_length: z.number().default(16384),
	model_path: z.string().optional(),
	high_risk_threshold: z.number().default(DEFAULT_PI_HIGH_RISK_THRESHOLD),
	medium_risk_threshold: z.number().default(DEFAULT_PI_MEDIUM_RISK_THRESHOLD),
});
export type PiCheckConfig = z.infer<typeof PiCheckConfigSchema>;

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
	pi_check: PiCheckConfigSchema.default({}),
	heuristics_enabled: z.boolean().default(true),
	cache: CacheConfigSchema.default({}),
	allowlist: AllowlistConfigSchema.default({}),
	exceptions: ExceptionsConfigSchema.default({}),
	logging: LoggingConfigSchema.default({}),
	sensitivity: SensitivitySchema.default("balanced"),
	disabled_threats: z.array(z.string()).default([]),
	brand_key: z
		.string()
		.min(1)
		.max(32)
		.regex(/^[a-z0-9_-]+$/u)
		.optional(),
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
	recommendations?: string[];
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
	recommendations?: string[];
}

export interface PluginScanCache {
	configHash: string;
	entries: Record<string, CachedPluginScanResult>;
}

// ── Branding ───────────────────────────────────────────────────────

export interface Branding {
	name: string;
	short_name: string;
	brand_key?: string;
}

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
