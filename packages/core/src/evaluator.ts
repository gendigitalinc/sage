/**
 * Shared runtime evaluation pipeline for hook entry points.
 * Hooks should normalize transport-specific payloads, then call this function.
 */

import { randomUUID } from "node:crypto";
import { isAllowlisted, loadAllowlist } from "./allowlist.js";
import { logVerdict } from "./audit-log.js";
import { VerdictCache } from "./cache.js";
import { AmsiClient, isAmsiSupported } from "./clients/amsi.js";
import { UrlCheckClient } from "./clients/url-check.js";
import { loadConfig } from "./config.js";
import { sendCommunityIqDetection } from "./detection-telemetry.js";
import { DecisionEngine } from "./engine.js";
import { findAllowException, findDenyException, loadExceptions } from "./exceptions.js";
import { HeuristicsEngine } from "./heuristics.js";
import { PackageChecker } from "./package-checker.js";
import {
	extractPackagesFromCommand,
	extractPackagesFromManifest,
	type ParsedPackage,
} from "./package-extractor.js";
import { updateSessionStatus } from "./statusline.js";
import { loadThreats } from "./threat-loader.js";
import { loadTrustedDomains } from "./trusted-domains.js";
import type {
	AgentRuntime,
	AmsiCheckResult,
	Artifact,
	AuditSignals,
	CachedVerdict,
	Config,
	HookType,
	Logger,
	PackageCheckResult,
	UrlCheckResult,
	Verdict,
} from "./types.js";
import { ConfigSchema, nullLogger } from "./types.js";
import { VERSION } from "./version.js";

export interface ToolEvaluationRequest {
	sessionId: string;
	conversationId?: string;
	agentRuntime?: AgentRuntime;
	hookType?: HookType;
	toolName: string;
	toolInput: Record<string, unknown>;
	artifacts: Artifact[];
}

export interface ToolEvaluationContext {
	threatsDir: string;
	allowlistsDir: string;
	configPath?: string;
	logger?: Logger;
}

export function allowVerdict(source = "none"): Verdict {
	return {
		decision: "allow",
		category: "none",
		confidence: 1.0,
		severity: "info",
		source,
		artifacts: [],
		matchedThreatId: null,
		reasons: [],
	};
}

export async function evaluateToolCall(
	request: ToolEvaluationRequest,
	context: ToolEvaluationContext,
): Promise<Verdict> {
	const logger = context.logger ?? nullLogger;
	const config = await loadConfig(context.configPath, logger).catch(() => ConfigSchema.parse({}));

	if (request.artifacts.length === 0) {
		return allowVerdict("no_artifacts");
	}

	// 1. Deny exceptions first (user-defined blacklist)
	try {
		const exceptions = await loadExceptions(config.exceptions, logger);
		const denyMatch = findDenyException(exceptions, request.artifacts);
		if (denyMatch) {
			const verdict: Verdict = {
				decision: "deny",
				category: "exception",
				confidence: 1.0,
				severity: "critical",
				source: "exception",
				artifacts: [denyMatch.artifact.value],
				matchedThreatId: null,
				reasons: [
					`Deny exception: ${denyMatch.rule.match} pattern '${denyMatch.rule.pattern}'${denyMatch.rule.reason ? ` — ${denyMatch.rule.reason}` : ""}`,
				],
			};
			try {
				await logVerdict(
					config.logging,
					request.sessionId,
					request.toolName,
					request.toolInput,
					verdict,
					false,
					request.conversationId,
					request.agentRuntime,
					request.hookType,
					undefined,
					undefined,
				);
			} catch {
				// Fail open.
			}
			return verdict;
		}

		// 2. Legacy exact-match allowlist (unchanged)
		try {
			const allowlist = await loadAllowlist(config.allowlist, logger);
			if (isAllowlisted(allowlist, request.artifacts)) {
				const allowV = allowVerdict("allowlisted");
				await logVerdict(
					config.logging,
					request.sessionId,
					request.toolName,
					request.toolInput,
					allowV,
					true,
					request.conversationId,
					request.agentRuntime,
					request.hookType,
					undefined,
					undefined,
				);
				return allowV;
			}
		} catch {
			// Fail open if allowlist loading fails.
		}

		// 3. Allow exceptions (pattern-based, with match-type-aware semantics)
		const allowMatch = findAllowException(exceptions, request.artifacts);
		if (allowMatch) {
			const allowV = allowVerdict("exception");
			try {
				await logVerdict(
					config.logging,
					request.sessionId,
					request.toolName,
					request.toolInput,
					allowV,
					true,
					request.conversationId,
					request.agentRuntime,
					request.hookType,
					undefined,
					undefined,
				);
			} catch {
				// Fail open.
			}
			return allowV;
		}
	} catch {
		// Fail open if exceptions loading fails.
	}

	let cache: VerdictCache | null = null;
	try {
		cache = new VerdictCache(config.cache, logger, VERSION);
		await cache.load();
	} catch {
		cache = null;
	}

	const urls = request.artifacts
		.filter((artifact) => artifact.type === "url")
		.map((artifact) => artifact.value);
	const { cachedUrlVerdicts, uncachedUrls } = partitionUrlsByCache(urls, cache);

	let heuristicMatches: ReturnType<HeuristicsEngine["match"]> = [];
	if (config.heuristics_enabled) {
		let threats = await loadThreats(context.threatsDir, logger);
		if (config.disabled_threats.length > 0) {
			const disabledSet = new Set(config.disabled_threats);
			threats = threats.filter((t) => !disabledSet.has(t.id));
		}
		const trustedDomains = await loadTrustedDomains(context.allowlistsDir, logger);
		const heuristics = new HeuristicsEngine(threats, trustedDomains);
		heuristicMatches = heuristics.match(request.artifacts);
	}

	let urlCheckResults: Awaited<ReturnType<UrlCheckClient["checkUrls"]>> = [];
	const urlsToCheck = cache ? uncachedUrls : urls;
	if (urlsToCheck.length > 0 && config.url_check.enabled) {
		try {
			const client = new UrlCheckClient(config.url_check, logger);
			urlCheckResults = await client.checkUrls(urlsToCheck);
		} catch {
			// Fail open.
		}
	}

	const packageCheckResults = await checkPackages(request, config, cache, logger);

	// AMSI scan (Windows only)
	const amsiCheckResults: AmsiCheckResult[] = [];
	if (config.amsi_check.enabled && isAmsiSupported()) {
		let amsiClient: AmsiClient | null = null;
		try {
			amsiClient = new AmsiClient(logger);
			await amsiClient.init();
			if (amsiClient.isAvailable) {
				const scans: { content: string; name: string }[] = [];

				if (request.toolName === "Bash") {
					const command = (request.toolInput.command ?? "") as string;
					if (command) {
						scans.push({ content: command, name: `Bash:command` });
					}
				} else if (request.toolName === "Write") {
					const filePath = (request.toolInput.file_path ?? "") as string;
					const content = (request.toolInput.content ?? "") as string;
					if (content) {
						scans.push({ content, name: `Write:${filePath}` });
					}
				} else if (request.toolName === "Edit") {
					const filePath = (request.toolInput.file_path ?? "") as string;
					const newString = (request.toolInput.new_string ?? "") as string;
					if (newString) {
						scans.push({ content: newString, name: `Edit:${filePath}` });
					}
				}

				for (const scan of scans) {
					const result = await amsiClient.scanString(scan.content, scan.name);
					if (result) {
						amsiCheckResults.push(result);
					}
				}
			}
		} catch {
			// Fail open
		} finally {
			amsiClient?.close();
		}
	}

	const engine = new DecisionEngine(config.sensitivity);
	let verdict = await engine.decide({
		heuristicMatches,
		urlCheckResults,
		packageCheckResults: packageCheckResults.length > 0 ? packageCheckResults : undefined,
		amsiCheckResults: amsiCheckResults.length > 0 ? amsiCheckResults : undefined,
	});

	if (cachedUrlVerdicts.size > 0 && verdict.decision === "allow") {
		for (const [url, cachedVerdict] of cachedUrlVerdicts) {
			if (cachedVerdict.verdict === "allow") {
				continue;
			}
			verdict = {
				decision: cachedVerdict.verdict,
				category: "network_egress",
				confidence: 1.0,
				severity: cachedVerdict.severity,
				source: `cache(${cachedVerdict.source})`,
				artifacts: [url],
				matchedThreatId: null,
				reasons: cachedVerdict.reasons,
			};
			break;
		}
	}

	await cacheUrlResults(urlCheckResults, cache);

	function formatPackageDetectionName(p: PackageCheckResult): string {
		const base = `PKG|${p.verdict}|registry=${p.registry}|name=${p.packageName}`;
		if (p.verdict === "suspicious_age") {
			const ageDays = typeof p.ageDays === "number" ? Math.floor(p.ageDays) : undefined;
			return ageDays !== undefined ? `${base}|age_days=${ageDays}` : base;
		}
		if (p.verdict === "malicious") {
			const det = (p.fileDetectionNames ?? []).filter((d) => typeof d === "string" && d.length > 0);
			return det.length > 0 ? `${base}|det=${det.join(",")}` : base;
		}
		return base;
	}

	const auditSignals: AuditSignals = {};
	if (heuristicMatches.length > 0) {
		auditSignals.heuristics = heuristicMatches.map((m) => ({
			rule_id: m.threat.id,
			rule_version: typeof m.threat.version === "number" ? m.threat.version : undefined,
		}));
	}
	if (urlCheckResults.length > 0) {
		const relevant = urlCheckResults.filter((r) => r.isMalicious || r.flags.length > 0);
		if (relevant.length > 0) {
			auditSignals.url_checks = relevant.flatMap((r) => {
				return r.detections.map((d) => ({
					detection_name: d,
					url: r.url,
				}));
			});
		}
	}
	if (packageCheckResults.length > 0) {
		const relevant = packageCheckResults.filter((p) => p.verdict !== "clean");
		if (relevant.length > 0) {
			auditSignals.package_checks = relevant.map((p) => ({
				detection_name: formatPackageDetectionName(p),
				package_name: p.packageName,
				package_version: undefined,
				package_registry: p.registry,
			}));
		}

		const fileRelevant = relevant.filter(
			(p) => !!p.fileSha256 && (p.fileDetectionNames?.length ?? 0) > 0,
		);
		if (fileRelevant.length > 0) {
			auditSignals.file_checks = fileRelevant.map((p) => ({
				detection_name: (p.fileDetectionNames ?? []).join(","),
				file_sha256: p.fileSha256 as string,
			}));
		}
	}

	const eventId = randomUUID();
	const resolvedSignals = Object.keys(auditSignals).length > 0 ? auditSignals : undefined;

	try {
		await logVerdict(
			config.logging,
			request.sessionId,
			request.toolName,
			request.toolInput,
			verdict,
			false,
			request.conversationId,
			request.agentRuntime,
			request.hookType,
			resolvedSignals,
			eventId,
		);
	} catch {
		// Fail open.
	}

	if (verdict.decision === "deny") {
		try {
			await sendCommunityIqDetection({
				eventId,
				agentRuntime: request.agentRuntime,
				hookType: request.hookType,
				toolName: request.toolName,
				toolInput: request.toolInput,
				signals: resolvedSignals,
				communityIqEnabled: config.community_iq,
				logger,
			});
		} catch {
			// Fail open — never block verdict delivery.
		}
	}

	if (verdict.decision !== "allow") {
		try {
			await updateSessionStatus(request.sessionId, verdict);
		} catch {
			// Fail open — never block verdict delivery.
		}
	}

	return verdict;
}

function partitionUrlsByCache(
	urls: string[],
	cache: VerdictCache | null,
): { cachedUrlVerdicts: Map<string, CachedVerdict>; uncachedUrls: string[] } {
	const cachedUrlVerdicts = new Map<string, CachedVerdict>();
	let uncachedUrls: string[] = [];

	if (cache && urls.length > 0) {
		try {
			for (const url of urls) {
				const cached = cache.getUrl(url);
				if (cached !== null) {
					cachedUrlVerdicts.set(url, cached);
				} else {
					uncachedUrls.push(url);
				}
			}
		} catch {
			uncachedUrls = urls;
		}
	}

	return { cachedUrlVerdicts, uncachedUrls };
}

async function cacheUrlResults(
	urlCheckResults: UrlCheckResult[],
	cache: VerdictCache | null,
): Promise<void> {
	if (!cache) return;
	try {
		for (const result of urlCheckResults) {
			let cachedVerdict: CachedVerdict;
			if (result.isMalicious) {
				cachedVerdict = {
					verdict: "deny",
					severity: "critical",
					reasons: [
						`URL check: malicious (${result.findings
							.map((finding) => `${finding.severityName}/${finding.typeName}`)
							.join(", ")})`,
					],
					source: "url_check",
				};
			} else if (result.flags.length > 0) {
				cachedVerdict = {
					verdict: "ask",
					severity: "warning",
					reasons: [`URL check: suspicious (${result.flags.join(", ")})`],
					source: "url_check",
				};
			} else {
				cachedVerdict = {
					verdict: "allow",
					severity: "info",
					reasons: [],
					source: "url_check",
				};
			}
			cache.putUrl(result.url, cachedVerdict, result.isMalicious);
		}
		await cache.save();
	} catch {
		// Fail open.
	}
}

async function checkPackages(
	request: ToolEvaluationRequest,
	config: Config,
	cache: VerdictCache | null,
	logger: Logger,
): Promise<PackageCheckResult[]> {
	const results: PackageCheckResult[] = [];
	if (!config.package_check.enabled) return results;

	try {
		let parsedPackages: ParsedPackage[] | undefined;
		if (request.toolName === "Bash") {
			const command = (request.toolInput.command ?? "") as string;
			parsedPackages = extractPackagesFromCommand(command);
		} else if (request.toolName === "Write" || request.toolName === "Edit") {
			const filePath = (request.toolInput.file_path ?? "") as string;
			const content = (request.toolInput.content ?? request.toolInput.new_string ?? "") as string;
			parsedPackages = extractPackagesFromManifest(filePath, content);
		}

		if (!parsedPackages || parsedPackages.length === 0) return results;

		const uncached: ParsedPackage[] = [];
		for (const pkg of parsedPackages) {
			const cacheKey = `${pkg.registry}:${pkg.name}${pkg.version ? `@${pkg.version}` : ""}`;
			const cached = cache?.getPackage(cacheKey);
			if (cached && cached.verdict !== "allow") {
				results.push({
					packageName: pkg.name,
					registry: pkg.registry,
					verdict: cached.verdict === "deny" ? "malicious" : "suspicious_age",
					confidence: 1.0,
					details: cached.reasons.join("; "),
				});
			} else if (!cached) {
				uncached.push(pkg);
			}
		}

		if (uncached.length > 0) {
			const checker = new PackageChecker(
				{
					registryTimeoutSeconds: config.package_check.timeout_seconds,
					fileCheckEndpoint: config.file_check.endpoint,
					fileCheckTimeoutSeconds: config.file_check.timeout_seconds,
					fileCheckEnabled: config.file_check.enabled,
				},
				logger,
			);
			const checked = await checker.checkPackages(uncached);
			results.push(...checked);

			if (cache) {
				for (const result of checked) {
					const pkg = uncached.find((p) => p.name === result.packageName);
					const cacheKey = `${result.registry}:${result.packageName}${pkg?.version ? `@${pkg.version}` : ""}`;
					const isCritical = result.verdict === "malicious" || result.verdict === "not_found";
					cache.putPackage(
						cacheKey,
						{
							verdict: result.verdict === "clean" ? "allow" : isCritical ? "deny" : "ask",
							severity: isCritical ? "critical" : "warning",
							reasons: [result.details],
							source: "package_check",
						},
						result.ageDays ?? null,
					);
				}
			}
		}
	} catch {
		// Fail open
	}

	return results;
}
