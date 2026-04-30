/**
 * Shared SessionStart scanning pipeline for hook entry points.
 * Hooks provide transport-specific paths and output formatting.
 */

import { logPluginScan } from "./audit-log.js";
import { AmsiClient, isAmsiSupported } from "./clients/amsi.js";
import { loadConfig } from "./config.js";
import { findPluginAllowException, findPluginDenyException, loadExceptions } from "./exceptions.js";
import {
	computeConfigHash,
	getCached,
	loadScanCache,
	saveScanCache,
	storeResult,
} from "./plugin-scan-cache.js";
import { scanPlugin } from "./plugin-scanner.js";
import type {
	Config,
	ExceptionRule,
	Logger,
	PluginFinding,
	PluginFindingData,
	PluginInfo,
	PluginScanResult,
} from "./types.js";
import { nullLogger } from "./types.js";

export interface SessionStartScanContext {
	plugins: PluginInfo[];
	threatsDir: string;
	allowlistsDir: string;
	sageVersion?: string;
	logger?: Logger;
	configPath?: string;
	scanCachePath?: string;
	checkUrls?: boolean;
	checkFileHashes?: boolean;
}

export function fromCachedFinding(finding: PluginFindingData): PluginFinding {
	return {
		threatId: finding.threat_id,
		title: finding.title,
		severity: finding.severity,
		confidence: finding.confidence,
		action: finding.action,
		artifact: finding.artifact,
		sourceFile: finding.source_file,
		recommendations: finding.recommendations,
	};
}

export function toFindingData(finding: PluginFinding): PluginFindingData {
	return {
		threat_id: finding.threatId,
		title: finding.title,
		severity: finding.severity,
		confidence: finding.confidence,
		action: finding.action,
		artifact: finding.artifact,
		source_file: finding.sourceFile,
		recommendations: finding.recommendations,
	};
}

export function toAuditFindingData(finding: PluginFinding): Record<string, unknown> {
	const { action: _, ...rest } = toFindingData(finding);
	return rest;
}

export async function runSessionStartScan(
	context: SessionStartScanContext,
): Promise<PluginScanResult[]> {
	const logger = context.logger ?? nullLogger;

	const sageConfig = await loadConfig(context.configPath, logger);

	const plugins = context.plugins;
	if (plugins.length === 0) {
		return [];
	}

	// Load exceptions for plugin allow/deny rules
	let exceptions: ExceptionRule[] = [];
	try {
		exceptions = await loadExceptions(sageConfig.exceptions, logger);
	} catch {
		// Fail open — proceed without exceptions.
	}

	// Initialize AMSI once, reuse across all plugins
	let amsiClient: AmsiClient | null = null;
	if (sageConfig.amsi_check.enabled && isAmsiSupported()) {
		try {
			amsiClient = new AmsiClient(logger);
			await amsiClient.init();
			if (!amsiClient.isAvailable) {
				amsiClient.close();
				amsiClient = null;
			}
		} catch {
			amsiClient?.close();
			amsiClient = null;
		}
	}

	try {
		return await scanAllPlugins(context, sageConfig, plugins, exceptions, amsiClient, logger);
	} finally {
		amsiClient?.close();
	}
}

async function scanAllPlugins(
	context: SessionStartScanContext,
	config: Config,
	plugins: PluginInfo[],
	exceptions: ExceptionRule[],
	amsiClient: AmsiClient | null,
	logger: Logger,
): Promise<PluginScanResult[]> {
	const configHash = await computeConfigHash(
		context.sageVersion ?? "",
		context.threatsDir,
		context.allowlistsDir,
	);
	const cache = await loadScanCache(configHash, context.scanCachePath, logger);
	const resultsWithFindings: PluginScanResult[] = [];
	let cacheModified = false;

	for (const plugin of plugins) {
		// 1. Exception checks — always run first, before cache
		const denyMatch = findPluginDenyException(exceptions, plugin.key);
		if (denyMatch) {
			resultsWithFindings.push({
				plugin,
				findings: [
					{
						threatId: "EXCEPTION-DENY",
						title: `Denied by exception: ${denyMatch.pattern}${denyMatch.reason ? ` — ${denyMatch.reason}` : ""}`,
						severity: "critical",
						confidence: 1.0,
						action: "block",
						artifact: plugin.key,
						sourceFile: "~/.sage/exceptions.json",
					},
				],
			});
			continue;
		}

		const allowMatch = findPluginAllowException(exceptions, plugin.key);
		if (allowMatch) {
			continue;
		}

		// 2. Cache check (only reached when no exception matched)
		const cached = getCached(cache, plugin.key, plugin.version, plugin.lastUpdated);
		if (cached && cached.findings.length === 0) {
			continue;
		}

		if (cached && cached.findings.length > 0) {
			resultsWithFindings.push({
				plugin,
				findings: cached.findings.map(fromCachedFinding),
			});
			continue;
		}

		// 3. Scan (only reached on cache miss with no exception)
		const result = await scanPlugin(plugin, {
			checkUrls: context.checkUrls ?? true,
			checkFileHashes: context.checkFileHashes ?? true,
			amsiClient,
			logger,
		});

		storeResult(
			cache,
			plugin.key,
			plugin.version,
			plugin.lastUpdated,
			result.findings.map(toFindingData),
		);
		cacheModified = true;

		if (result.findings.length > 0) {
			resultsWithFindings.push(result);
		}
	}

	if (cacheModified) {
		await saveScanCache(cache, context.scanCachePath, logger);
	}

	try {
		for (const result of resultsWithFindings) {
			await logPluginScan(
				config.logging,
				result.plugin.key,
				result.plugin.version,
				result.findings.map(toAuditFindingData),
			);
		}
	} catch {
		// Logging must never crash the hook.
	}

	return resultsWithFindings;
}
