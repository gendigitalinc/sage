/**
 * Package supply-chain checker.
 * Orchestrates registry lookup + file reputation check + age analysis.
 */

import { FileCheckClient } from "./clients/file-check.js";
import { type PackageMetadata, RegistryClient } from "./clients/package-registry.js";
import type { Logger, PackageCheckResult } from "./types.js";
import { nullLogger } from "./types.js";

const SUSPICIOUS_AGE_DAYS = 7;
const MAX_CONCURRENT = 10;

export interface PackageCheckInput {
	name: string;
	registry: "npm" | "pypi";
	version?: string;
}

export interface PackageCheckerConfig {
	registryTimeoutSeconds?: number;
	fileCheckEndpoint?: string;
	fileCheckTimeoutSeconds?: number;
	fileCheckEnabled?: boolean;
}

export class PackageChecker {
	private readonly registryClient: RegistryClient;
	private readonly fileCheckClient: FileCheckClient | null;
	private readonly logger: Logger;

	constructor(config: PackageCheckerConfig = {}, logger: Logger = nullLogger) {
		this.logger = logger;
		this.registryClient = new RegistryClient(
			{ timeout_seconds: config.registryTimeoutSeconds },
			logger,
		);
		this.fileCheckClient =
			config.fileCheckEnabled !== false
				? new FileCheckClient(
						{
							endpoint: config.fileCheckEndpoint,
							timeout_seconds: config.fileCheckTimeoutSeconds,
						},
						logger,
					)
				: null;
	}

	async checkPackages(packages: PackageCheckInput[]): Promise<PackageCheckResult[]> {
		// v1: Skip all scoped packages (@scope/pkg) — they are typically from
		// private registries and would false-positive against public npm.
		// Future: support configurable public/private scope lists.
		const toCheck: PackageCheckInput[] = [];
		const results: PackageCheckResult[] = [];

		for (const pkg of packages) {
			if (pkg.name.startsWith("@")) {
				results.push({
					packageName: pkg.name,
					registry: pkg.registry,
					verdict: "clean",
					confidence: 1.0,
					details: "Scoped package — skipped (v1)",
				});
			} else {
				toCheck.push(pkg);
			}
		}

		// Run checks with concurrency limit
		const checkResults = await this.runWithConcurrencyLimit(
			toCheck,
			(pkg) => this.checkSinglePackage(pkg),
			MAX_CONCURRENT,
		);
		results.push(...checkResults);

		return results;
	}

	async checkSinglePackage(pkg: PackageCheckInput): Promise<PackageCheckResult> {
		// Step 1: Query registry
		let metadata: PackageMetadata | null;
		try {
			metadata = await this.registryClient.getPackageMetadata(pkg.name, pkg.registry, pkg.version);
		} catch {
			return {
				packageName: pkg.name,
				registry: pkg.registry,
				verdict: "unknown",
				confidence: 0.6,
				details: `Package check for '${pkg.name}' timed out (verify manually)`,
			};
		}

		if (metadata === null) {
			return {
				packageName: pkg.name,
				registry: pkg.registry,
				verdict: "not_found",
				confidence: 0.95,
				details: `Package '${pkg.name}' not found on ${pkg.registry} (non-existent or misspelled)`,
			};
		}

		// Step 2a: Check if requested version exists
		if (!metadata.requestedVersionFound && pkg.version) {
			return {
				packageName: pkg.name,
				registry: pkg.registry,
				verdict: "not_found",
				confidence: 0.9,
				details: `Package '${pkg.name}@${pkg.version}' version not found on ${pkg.registry} (hallucinated or unpublished)`,
			};
		}

		// Step 2b: File reputation check (sha256 only — file-check API requires sha256)
		if (metadata.latestHash && this.fileCheckClient && metadata.hashAlgorithm === "sha256") {
			try {
				const fileResult = await this.fileCheckClient.checkHash(metadata.latestHash);
				if (fileResult) {
					const sev = fileResult.severity.toUpperCase();
					if (sev === "SEVERITY_MALWARE") {
						const detections =
							fileResult.detectionNames.length > 0 ? fileResult.detectionNames.join(", ") : sev;
						return {
							packageName: pkg.name,
							registry: pkg.registry,
							verdict: "malicious",
							confidence: 1.0,
							details: `Malicious package '${pkg.name}' (${detections})`,
							fileCheckSeverity: sev,
							fileSha256: metadata.latestHash,
							fileDetectionNames: fileResult.detectionNames,
						};
					}
				}
			} catch {
				// File-check is supplementary — fail-open
				this.logger.warn("File-check failed for package", { name: pkg.name });
			}
		}

		// Step 3: Age check
		const ageDays = metadata.firstReleaseDate
			? (Date.now() - metadata.firstReleaseDate.getTime()) / (1000 * 60 * 60 * 24)
			: undefined;

		if (ageDays !== undefined && ageDays < SUSPICIOUS_AGE_DAYS) {
			return {
				packageName: pkg.name,
				registry: pkg.registry,
				verdict: "suspicious_age",
				confidence: 0.75,
				details: `Package '${pkg.name}' first published ${Math.floor(ageDays)} days ago (suspicious age)`,
				ageDays,
			};
		}

		// Step 4: Clean
		return {
			packageName: pkg.name,
			registry: pkg.registry,
			verdict: "clean",
			confidence: 1.0,
			details: `Package '${pkg.name}' verified on ${pkg.registry}`,
			ageDays,
		};
	}

	private async runWithConcurrencyLimit<T, R>(
		items: T[],
		fn: (item: T) => Promise<R>,
		limit: number,
	): Promise<R[]> {
		const results: R[] = [];
		const executing: Promise<void>[] = [];

		for (const item of items) {
			const p = fn(item).then((r) => {
				results.push(r);
			});
			executing.push(p);

			if (executing.length >= limit) {
				await Promise.race(executing);
				// Remove settled promises
				for (let i = executing.length - 1; i >= 0; i--) {
					const settled = await Promise.race([
						executing[i]?.then(() => true),
						Promise.resolve(false),
					]);
					if (settled) executing.splice(i, 1);
				}
			}
		}
		await Promise.allSettled(executing);
		return results;
	}
}
