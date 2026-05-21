// @gendigital/sage-core public API

// Allowlist
export { emptyAllowlist, isAllowlisted, loadAllowlist } from "./allowlist.js";
export type { ApprovedEntry, PendingEntry } from "./approval-store.js";
// Approval store
export { ApprovalStore } from "./approval-store.js";
// Audit log
export {
	AUDIT_LOG_SCHEMA_VERSION,
	findPiWarningInAuditLog,
	getRecentEntries,
	logPluginScan,
	logVerdict,
	type VerdictLogEntry,
} from "./audit-log.js";
// Branding
export { BRANDS, defaultBranding, resolveBranding } from "./brands.js";
// Cache
export { VerdictCache } from "./cache.js";
// AMSI client
export { AmsiClient, isAmsiSupported } from "./clients/amsi.js";
export { ContentFetchClient } from "./clients/content-fetch.js";
export type { FileCheckBatchResult, FileCheckResult } from "./clients/file-check.js";
// File-check client
export { FileCheckClient } from "./clients/file-check.js";
// Model downloader
export { type DownloadModelOptions, downloadModel } from "./clients/model-downloader.js";
// Model manifest fetch
export {
	fetchModelManifest,
	type ManifestRequestBody,
	type ModelManifest,
	type ModelManifestEntry,
} from "./clients/model-manifest.js";
export type { PackageMetadata } from "./clients/package-registry.js";
// Registry client
export { RegistryClient } from "./clients/package-registry.js";
export type { PiCheckProvider } from "./clients/pi-check.js";
// PI (prompt-injection) check client
export { BundledPiProvider, StubPiProvider } from "./clients/pi-check.js";
export { ensurePiDeps } from "./clients/pi-deps-installer.js";
// Skill check client
export {
	SkillCheckClient,
	type SkillCheckClientConfig,
	type SkillCheckResult,
	type SkillRiskLevel,
} from "./clients/skill-check.js";
// URL check client
export { resolveEndpoint, UrlCheckClient } from "./clients/url-check.js";
// Config
export {
	getClaudeConfigDir,
	HOOK_TIMEOUT_SECONDS,
	loadConfig,
	loadConfigSync,
	resolvePath,
	SAGE_DIR,
} from "./config.js";
export {
	extractWebFetchUrl,
	getUrlExtension,
	isScannableContent,
	SCANNABLE_EXTENSIONS,
} from "./content-policy.js";
// Content snapshot (shared content builder + scrub/truncate utilities)
export {
	buildContentSnapshot,
	CONTENT_FIELD_LIMITS,
	safeTruncate,
	scrubHomePath,
} from "./content-snapshot.js";
// Detection telemetry (Community IQ)
export {
	type DetectionTelemetryArgs,
	sendCommunityIqDetection,
} from "./detection-telemetry.js";
// Decision engine
export { CONFIDENCE_THRESHOLD, DecisionEngine } from "./engine.js";
// Runtime evaluator
export {
	allowVerdict,
	evaluateToolCall,
	evaluateToolOutput,
	extractOutputForPiCheck,
	type ToolEvaluationContext,
	type ToolEvaluationRequest,
	type ToolOutputWarning,
} from "./evaluator.js";
// Exceptions
export {
	addException,
	computeRuleId,
	type DenyExceptionMatch,
	findAllowException,
	findDenyException,
	findPluginAllowException,
	findPluginDenyException,
	loadExceptions,
	matchesDomain,
	matchesExecutable,
	matchesPath,
	matchesPlugin,
	matchesRegex,
} from "./exceptions.js";
// Extended info enrichment
export {
	EXTENDED_INFO_FILE_MAX_BYTES,
	EXTENDED_INFO_FILENAME,
	EXTENDED_INFO_MAX_GROUPS,
	EXTENDED_INFO_MAX_KEYS_PER_GROUP,
	EXTENDED_INFO_MAX_LEAF_CHARS,
	type ExtendedInfo,
	type ExtendedInfoGroup,
	type ExtendedInfoLeaf,
	loadExtendedInfo,
	mergeExtendedInfo,
	resetExtendedInfoCache,
} from "./extended-info.js";
// Extractors
export {
	extractFromBash,
	extractFromDelete,
	extractFromEdit,
	extractFromRead,
	extractFromWebFetch,
	extractFromWrite,
	extractUrls,
	MAX_CONTENT_SIZE,
} from "./extractors.js";
// File utilities
export {
	atomicWriteJson,
	getFileContent,
	getFileContentSync,
	getHomeDir,
	pruneOrphanedTmpFiles,
} from "./file-utils.js";
// Format (shared alert formatting)
export {
	formatMigrationNotice,
	formatPiWarning,
	formatSessionStartMessage,
	formatStartupClean,
	formatThreatBanner,
	formatUpdateNotice,
	kv,
	PAD,
	SEPARATOR_WIDTH,
	separatorLine,
	severityEmoji,
	type ThreatBannerStyle,
} from "./format.js";
// Guard (soft-gated connector orchestrator)
export {
	approveAction,
	formatAskMessage,
	formatDenyMessage,
	type GuardResult,
	guardToolCall,
	summarizeArtifacts,
} from "./guard.js";
// Heuristics
export { HeuristicsEngine } from "./heuristics.js";
// Installation ID
export { getInstallationId } from "./installation-id.js";
// Marketplace migration (TODO: remove after v0.7.x) // gitleaks:allow
export { needsMarketplaceMigration } from "./marketplace-migration.js";
// Background model download orchestration
export {
	type EnsureModelsAvailableArgs,
	ensureModelsAvailable,
} from "./model-download.js";
// Model storage (per-user, per-schema cache under ~/.sage/models/)
export {
	anyRequiredModelMissing,
	getDownloadStagingDir,
	getModelDir,
	getModelStorageRoot,
	isModelPresent,
	MODEL_SCHEMA_VERSION,
	missingRequiredModels,
	REQUIRED_MODELS_BY_SCHEMA,
	requiredModelFiles,
} from "./model-storage.js";
export type { PackageCheckerConfig, PackageCheckInput } from "./package-checker.js";
// Package checker
export { PackageChecker } from "./package-checker.js";
export type { ParsedPackage } from "./package-extractor.js";
// Package extractor
export { extractPackagesFromCommand, extractPackagesFromManifest } from "./package-extractor.js";
// Plugin scan cache
export {
	cacheKey,
	computeConfigHash,
	getCached,
	isCached,
	loadScanCache,
	saveScanCache,
	storeResult,
} from "./plugin-scan-cache.js";
// Plugin scanner
export { discoverPlugins, isPluginInstalledSync, scanPlugin } from "./plugin-scanner.js";
// Product version (host product.json reader)
export { readProductJsonVersion } from "./product-version.js";
// Sage Proxy (shared envelope / env)
export {
	buildSageProxyEnvelope,
	mapSageProxyArchitecture,
	mapSageProxyOs,
	type SageProxyEnvelope,
	type SageProxyOs,
} from "./sage-proxy.js";
// Scan handler
export { createScanHandler, runPluginScan, type ScanHandlerOptions } from "./scan-handler.js";
// Session start orchestrator
export {
	runSessionStart,
	type SessionStartContext,
	type SessionStartResult,
	type SpawnModelDownloadWorkerArgs,
	spawnModelDownloadWorker,
} from "./session-start.js";
// Session start scan pipeline
export {
	fromCachedFinding,
	runSessionStartScan,
	type SessionStartScanContext,
	toAuditFindingData,
	toFindingData,
} from "./session-start-scan.js";
// Skill identifier (content-addressed digest of a skill package)
export {
	computeSkillId,
	computeSkillIdsForRoot,
	entriesFromDirectory,
	findSkillPackages,
	type SkillArchiveEntry,
	type SkillIdResult,
} from "./skill-id.js";
// Session status (detection notifications)
export {
	formatStatusLine,
	initSessionStatus,
	pruneSessionStatusFiles,
	readSessionStatus,
	type SessionStatus,
	sanitizeSessionId,
	updateSessionStatus,
} from "./statusline.js";
// Threat loader
export { loadThreats } from "./threat-loader.js";
// Tool names (canonical vocabulary)
export {
	CANONICAL_SET,
	type CanonicalToolType,
	canonicalizeToolName,
} from "./tool-names.js";
// Trusted domains
export {
	extractDomain,
	isTrustedDomain,
	loadTrustedDomains,
} from "./trusted-domains.js";
export type {
	AgentRuntime,
	Allowlist,
	AllowlistConfig,
	AllowlistEntry,
	AmsiCheckConfig,
	AmsiCheckResult,
	AmsiScanType,
	Artifact,
	Branding,
	CacheConfig,
	CachedEntry,
	CachedPluginScanResult,
	CachedVerdict,
	CacheStore,
	Config,
	Decision,
	ExceptionDecision,
	ExceptionMatch,
	ExceptionRule,
	ExceptionsConfig,
	ExceptionsFile,
	FileCheckConfig,
	HeuristicMatch,
	HookType,
	Logger,
	LoggingConfig,
	PackageCheckConfig,
	PackageCheckResult,
	PiCheckConfig,
	PiCheckResult,
	PluginFinding,
	PluginFindingData,
	PluginInfo,
	PluginScanCache,
	PluginScanResult,
	SignalSources,
	Threat,
	ThreatData,
	TrustedDomain,
	UrlCheckConfig,
	UrlCheckFinding,
	UrlCheckResult,
	Verdict,
	VerdictSeverity,
} from "./types.js";
// Types
export {
	ActionSchema,
	AllowlistConfigSchema,
	ArtifactSchema,
	ArtifactTypeSchema,
	CacheConfigSchema,
	ConfigSchema,
	DecisionSchema,
	ExceptionDecisionSchema,
	ExceptionMatchSchema,
	ExceptionRuleSchema,
	ExceptionsConfigSchema,
	ExceptionsFileSchema,
	FileCheckConfigSchema,
	HookTypeSchema,
	LoggingConfigSchema,
	nullLogger,
	PackageCheckConfigSchema,
	PiCheckConfigSchema,
	SensitivitySchema,
	SeveritySchema,
	ThreatSchema,
	UrlCheckConfigSchema,
	VerdictSeveritySchema,
} from "./types.js";
// URL utilities
export { hashCommand, normalizeFilePath, normalizeUrl } from "./url-utils.js";
export type { VersionCheckContext, VersionCheckResult } from "./version-check.js";
// Version check
export { checkForUpdate, isNewerVersion } from "./version-check.js";
