/**
 * JSON file-based verdict cache for Sage.
 * Replaces the Python SQLite implementation.
 */

import { resolvePath } from "./config.js";
import { atomicWriteJson, getFileContent } from "./file-utils.js";
import type { CacheConfig, CachedVerdict, CacheStore, Logger } from "./types.js";
import { nullLogger } from "./types.js";
import { normalizeUrl } from "./url-utils.js";

const ONE_HOUR = 3600;
const TWENTY_FOUR_HOURS = 86400;

export class VerdictCache {
	private store: CacheStore = { urls: {}, packages: {} };
	private readonly path: string;
	private readonly config: CacheConfig;
	private readonly logger: Logger;
	private readonly version: string | undefined;

	constructor(config: CacheConfig, logger: Logger = nullLogger, version?: string) {
		this.config = config;
		this.logger = logger;
		this.path = resolvePath(config.path);
		this.version = version;
	}

	async load(): Promise<void> {
		if (!this.config.enabled) return;

		try {
			const raw = await getFileContent(this.path);
			const data = JSON.parse(raw) as CacheStore;
			this.store = {
				urls: data.urls ?? {},
				packages: data.packages ?? {},
			};
		} catch {
			this.store = { urls: {}, packages: {} };
		}
	}

	getUrl(url: string): CachedVerdict | null {
		if (!this.config.enabled) return null;
		const key = normalizeUrl(url);
		const entry = this.store.urls[key];
		if (!entry || this.isStale(entry)) return null;

		return {
			verdict: entry.verdict,
			severity: entry.severity,
			reasons: entry.reasons,
			source: entry.source,
			...(entry.urlSignalLabels !== undefined ? { urlSignalLabels: entry.urlSignalLabels } : {}),
		};
	}

	putUrl(url: string, verdict: CachedVerdict, isMalicious: boolean): void {
		if (!this.config.enabled) return;

		const key = normalizeUrl(url);
		const now = new Date();
		const ttl = isMalicious ? this.config.ttl_malicious_seconds : this.config.ttl_clean_seconds;
		const expiresAt = new Date(now.getTime() + ttl * 1000);

		this.store.urls[key] = {
			...verdict,
			checkedAt: now.toISOString(),
			expiresAt: expiresAt.toISOString(),
			sageVersion: this.version,
		};
	}

	getPackage(key: string): CachedVerdict | null {
		if (!this.config.enabled) return null;
		const entry = this.store.packages[key];
		if (!entry || this.isStale(entry)) return null;

		return {
			verdict: entry.verdict,
			severity: entry.severity,
			reasons: entry.reasons,
			source: entry.source,
			...(entry.packageVerdict !== undefined ? { packageVerdict: entry.packageVerdict } : {}),
			...(entry.packageConfidence !== undefined
				? { packageConfidence: entry.packageConfidence }
				: {}),
		};
	}

	putPackage(key: string, verdict: CachedVerdict, packageAgeDays: number | null): void {
		if (!this.config.enabled) return;

		// urlSignalLabels is URL-cache only; strip defensively so accidental misuse is a no-op.
		const { urlSignalLabels: _ignoredUrlLabels, ...rest } = verdict;
		const ttlSeconds = this.computePackageTtl(verdict.verdict, packageAgeDays);
		const now = new Date();
		const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

		this.store.packages[key] = {
			...rest,
			checkedAt: now.toISOString(),
			expiresAt: expiresAt.toISOString(),
			sageVersion: this.version,
		};
	}

	private isStale(entry: { expiresAt: string; sageVersion?: string }): boolean {
		if (new Date(entry.expiresAt).getTime() <= Date.now()) return true;
		if (this.version && this.version !== "dev" && entry.sageVersion !== this.version) return true;
		return false;
	}

	private computePackageTtl(verdict: string, packageAgeDays: number | null): number {
		const isFresh = packageAgeDays !== null && packageAgeDays < 7;

		switch (verdict) {
			case "deny":
				return TWENTY_FOUR_HOURS;
			case "allow":
				return isFresh ? ONE_HOUR : TWENTY_FOUR_HOURS;
			default:
				return ONE_HOUR;
		}
	}

	async save(): Promise<void> {
		if (!this.config.enabled) return;

		try {
			this.pruneStaleEntries();
			await atomicWriteJson(this.path, this.store);
		} catch (e) {
			this.logger.warn(`Failed to save cache to ${this.path}`, { error: String(e) });
		}
	}

	private pruneStaleEntries(): void {
		for (const [key, entry] of Object.entries(this.store.urls)) {
			if (this.isStale(entry)) delete this.store.urls[key];
		}
		for (const [key, entry] of Object.entries(this.store.packages)) {
			if (this.isStale(entry)) delete this.store.packages[key];
		}
	}
}
