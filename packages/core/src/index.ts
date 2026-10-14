// @gendigital/sage-core public API

// Hook tool call handler
export {
	registerHookHandlers,
	type HookHandlerOptions,
	type HookHostAPI,
	type HookToolMapping,
	type ToolCallAdapter,
	type ToolCallContext,
	type ToolCallEvent,
	type ToolCallResult,
} from "./hook-tool-call-handler.js";
// Allowlist migration warning
export {
	checkAllowlistMigration,
	formatAllowlistMigrationWarning,
} from "./allowlist-migration.js";
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
// Skill Analyzer upload client (Phase 2 — uploads unknown skill content)
export {
	SkillAnalyzeClient,
	type SkillAnalyzeClientConfig,
	type SkillAnalyzeMetadata,
	type SkillAnalyzeResult,
	type SkillAnalyzeVerdict,
} from "./clients/skill-analyze.js";
// Skill check client
export {
	SkillCheckClient,
	type SkillCheckClientConfig,
	type SkillCheckResult,
} from "./clients/skill-check.js";
// URL check client
export { resolveEndpoint, UrlCheckClient } from "./clients/url-check.js";
// Config
export {
	getClaudeConfigDir,
	HOOK_TIMEOUT_SECONDS,
	isFreshTimestamp,
	loadConfig,
	loadConfigSync,
	resolvePath,
	SAGE_DIR,
	skillCacheTtlMs,
} from "./config.js";
export {
	buildConfigDefaults,
	CONFIG_DEFAULTS_FILENAME,
	CONFIG_DEFAULTS_SCHEMA_VERSION,
	type ConfigDefaults,
	deployConfigDefaults,
	serializeConfigDefaults,
} from "./config-defaults.js";
// Config diagnostics
export {
	type ConfigurationWarning,
	formatConfigurationWarnings,
	getConfigurationWarnings,
	getConfigurationWarningsSync,
} from "./config-diagnostics.js";
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
// Canonical Sage-owned detection names
export {
	AMSI_DETECTION_NAMES,
	AMSI_REPORTING_RULE_NAMES,
	type AmsiDetectionClass,
	amsiDetectionName,
	amsiReportingData,
	buildSkillCheckSignal,
	formatReportingDetectionName,
	isCanonicalDetectionName,
	isSkillId,
	PACKAGE_DETECTION_NAMES,
	type PackageDetectionVerdict,
	PI_DETECTION_NAME,
	packageDetectionName,
	REPORTING_DETECTION_SUFFIX,
	REPORTING_ENGINE_SHORTHANDS,
	type ReportingDetectionEngine,
	SKILL_DETECTION_NAMES,
	type SkillCheckSignal,
	type SkillDetectionVerdict,
	skillDetectionName,
	skillReportingDetectionName,
} from "./detection-names.js";
// Detection telemetry (Community IQ)
export {
	type CommunityIqTelemetryArgs,
	sendCommunityIqTelemetry,
} from "./detection-telemetry.js";
// E2E hook-payload capture sink (Layer 2 drift loop; inert unless SAGE_E2E_CAPTURE_DIR is set).
// Runtime code (imported by the connector hooks, gated by env), so it lives on the
// main entry. The envelope-diff helpers it pairs with are test-only and live on the
// "@gendigital/sage-core/testing" subpath so they never reach a production bundle.
export {
	type CaptureOptions,
	captureEnabled,
	captureHookInput,
	type HookCaptureEvent,
} from "./e2e-capture.js";
// Decision engine
export { DecisionEngine } from "./engine.js";
// Runtime evaluator
export {
	type AmsiClientLease,
	allowVerdict,
	evaluateToolCall,
	evaluateToolOutput,
	extractOutputForPiCheck,
	type ToolEvaluationContext,
	type ToolEvaluationRequest,
	type ToolOutputEvaluationRequest,
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
	formatPiWarning,
	formatSessionStartMessage,
	formatStartupClean,
	formatThreatBanner,
	formatUpdateNotice,
	kv,
	PAD,
	remediationHint,
	ruleLabel,
	SEPARATOR_WIDTH,
	separatorLine,
	severityEmoji,
	type ThreatBannerStyle,
} from "./format.js";
// Guard (soft-gated connector orchestrator)
export {
	approveAction,
	formatDenyMessage,
	type GuardResult,
	guardToolCall,
	summarizeArtifacts,
} from "./guard.js";
// Heuristics
export { HeuristicsEngine } from "./heuristics.js";
// Install rollout state (skill-upload consent transition)
export {
	type DecideRolloutOptions,
	decideSkillUploadRollout,
	INSTALL_STATE_SCHEMA_VERSION,
	type InstallState,
	loadInstallState,
	type NoticeRecord,
	type RolloutDecision,
	resetSkillUploadRolloutForTest,
	resolveSkillUploadRollout,
	type SkillUploadRollout,
	saveInstallState,
	takePendingNotices,
} from "./install-state.js";
// Installation ID
export { getInstallationId } from "./installation-id.js";
// Shared JSONL log writer (append + rotation)
export { appendJsonlEntry, type JsonlLogConfig } from "./jsonl-log-writer.js";
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
// Session-start notices (id + message registry)
export {
	formatNotice,
	formatNoticeById,
	NOTICES,
	type NoticeDefinition,
	SKILL_UPLOAD_NOTICE,
} from "./notices.js";
// Operational logging
export {
	createOperationalLogger,
	type OperationalLogEntry,
} from "./operational-log.js";
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
export { applyPolicy, SENSITIVITY_POLICY } from "./policy.js";
// Product version (host product.json reader)
export { readProductJsonVersion } from "./product-version.js";
// Sage Proxy (shared envelope / env)
export {
	buildSageProxyEnvelope,
	buildSageUserConfig,
	mapSageHostArchitecture,
	mapSageHostOs,
	type SageHostOs,
	type SageProxyEnvelope,
	type SageUserConfig,
	type SageUserConfigInput,
} from "./sage-proxy.js";
// Scan handler
export { createScanHandler, runPluginScan, type ScanHandlerOptions } from "./scan-handler.js";
// Session start orchestrator
export {
	runSessionStart,
	type SessionStartContext,
	type SessionStartResult,
	type SpawnModelDownloadWorkerArgs,
	type SpawnSkillUploadWorkerArgs,
	spawnModelDownloadWorker,
	spawnSkillUploadWorker,
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
	dedupeSkillsByResolvedPath,
	discoverLooseSkills,
	discoverLooseSkillsAcrossRoots,
	entriesFromDirectory,
	findSkillPackagesWithMtime,
	looseSkillKey,
	type SkillArchiveEntry,
	type SkillIdResult,
	type SkillPackage,
	type SkillRoot,
	type SkillScope,
} from "./skill-id.js";
// Pending marker for skills queued to the upload worker (dedup across sessions)
export {
	addPending,
	isPending,
	listPending,
	loadPendingMarker,
	type PendingMarker,
	removePending,
	type SkillPendingEntry,
	type SkillPendingOrigin,
	savePendingMarker,
} from "./skill-pending.js";
// NOTE: skill-upload-worker.js is intentionally NOT re-exported here. It pulls in
// the fflate ZIP library, and re-exporting it dragged ~20 KB of ZIP code into
// every bundle that imports this barrel (session-start, mcp-server, statusline)
// even though only the detached upload worker needs it. The worker is built from
// its own entry point (esbuild) and tests import it directly from the module.
// Persistent Skill Analyzer verdict cache (keyed by content-addressed skill id)
export {
	type CachedSkillVerdict,
	getVerdict,
	loadSkillVerdictCache,
	loadSkillVerdictCacheReadOnly,
	loadSkillVerdictCacheSync,
	putVerdict,
	riskyVerdictsSince,
	type SkillVerdictCache,
	type SkillVerdictSource,
	saveSkillVerdictCache,
} from "./skill-verdict-cache.js";
export { resolveSkillVerdictEntryId } from "./skill-verdict-record.js";
// Session status (detection notifications)
export {
	agentRuntimeLabel,
	foreignSourceRuntime,
	formatStatusLine,
	initSessionStatus,
	pruneSessionStatusFiles,
	readSessionStatus,
	type SessionStatus,
	type SkillWarning,
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
	OperationalLoggingConfig,
	OperationalLogLevel,
	PackageCheckConfig,
	PackageCheckResult,
	PiCheckConfig,
	PiCheckResult,
	PluginFinding,
	PluginFindingData,
	PluginInfo,
	PluginScanCache,
	PluginScanResult,
	RuntimeOperationalLogger,
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
	OperationalLoggingConfigSchema,
	OperationalLogLevelSchema,
	PackageCheckConfigSchema,
	PiCheckConfigSchema,
	SensitivitySchema,
	ThreatSchema,
	UrlCheckConfigSchema,
	VerdictSeveritySchema,
} from "./types.js";
// URL utilities
export { normalizeFilePath, normalizeUrl } from "./url-utils.js";
export type { VersionCheckContext, VersionCheckResult } from "./version-check.js";
// Version check
export { checkForUpdate, isNewerVersion } from "./version-check.js";
