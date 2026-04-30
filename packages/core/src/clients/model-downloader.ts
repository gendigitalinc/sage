/**
 * Download + verify + extract a single model archive into the per-schema
 * model directory under `~/.sage/models/<schema>/<modelName>/`.
 *
 * Properties:
 *   - SHA-256 verified after the full archive is on disk; mismatches are
 *     logged at `warn` and the archive deleted.
 *   - Atomic publish: extraction goes into a sibling `<modelName>.partial/`
 *     directory under `models/.download/`, then a swap-rename moves it onto
 *     the target. If a stale `modelDir` already exists (e.g. previous run
 *     crashed mid-install), it is renamed aside before the swap and removed
 *     after.
 *   - Concurrency: a non-blocking PID/timestamp lock file prevents two
 *     Sage processes (CC + Cursor running together) from racing into the
 *     same install. Stale locks (> 1 h) are ignored.
 *   - Fail-open: every error path logs and returns `false`; the model
 *     simply stays unavailable until a future session succeeds.
 *
 * See `docs/model-update.md` §3.5 for the full design.
 */

import { createHash, randomBytes } from "node:crypto";
import { createWriteStream, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
	getDownloadStagingDir,
	getModelDir,
	isModelPresent,
	requiredModelFiles,
} from "../model-storage.js";
import type { Logger } from "../types.js";
import { nullLogger } from "../types.js";
import type { ModelManifestEntry } from "./model-manifest.js";

const STALE_LOCK_MS = 60 * 60 * 1_000; // 1 h

export interface DownloadModelOptions {
	modelName: string;
	entry: ModelManifestEntry;
	schema: string;
	sageDir?: string;
	logger?: Logger;
	/** Override fetch (mostly for tests). */
	fetchImpl?: typeof fetch;
}

/**
 * Download a single model. Returns true iff the model is on disk and
 * complete after the call (either we just installed it, or it was already
 * present, or another worker installed it concurrently while we held off).
 *
 * Never throws.
 */
export async function downloadModel(opts: DownloadModelOptions): Promise<boolean> {
	const logger = opts.logger ?? nullLogger;
	const { modelName, entry, schema, sageDir } = opts;

	if (isModelPresent(modelName, schema, sageDir)) return true;

	if (!entry.sha256) {
		logger.warn(`missing sha256 for model ${modelName}; aborting`);
		return false;
	}

	const modelDir = getModelDir(modelName, schema, sageDir);
	const stagingDir = getDownloadStagingDir(sageDir);
	const lockPath = `${modelDir}.lock`;

	try {
		await mkdir(stagingDir, { recursive: true });
		await mkdir(resolve(modelDir, ".."), { recursive: true });
	} catch (err) {
		logger.warn(`failed to prepare model storage for ${modelName}: ${err}`);
		return false;
	}

	const acquired = await tryAcquireLock(lockPath, logger);
	if (!acquired) {
		logger.debug(`another process is downloading ${modelName}; skipping`);
		return isModelPresent(modelName, schema, sageDir);
	}

	let archivePath: string | null = null;
	let extractDir: string | null = null;
	try {
		// Re-check after lock — another process may have just finished.
		if (isModelPresent(modelName, schema, sageDir)) return true;

		const suffix = randomBytes(6).toString("hex");
		archivePath = join(stagingDir, `${modelName}.${suffix}.tar.gz`);
		extractDir = join(stagingDir, `${modelName}.${suffix}.partial`);

		await streamFetchToFile(entry.url, archivePath, opts.fetchImpl);

		const actualSha = await sha256OfFile(archivePath);
		if (actualSha !== entry.sha256.toLowerCase()) {
			logger.warn(`checksum mismatch for model ${modelName}`, {
				expected: entry.sha256,
				actual: actualSha,
			});
			return false;
		}

		await mkdir(extractDir, { recursive: true });
		await extractTarGz(archivePath, extractDir);

		const extractDirResolved = extractDir;
		const missing = requiredModelFiles(modelName).filter(
			(f) => !fileExistsSync(resolve(extractDirResolved, f)),
		);
		if (missing.length > 0) {
			logger.warn(`failed to install model ${modelName}: archive missing ${missing.join(", ")}`);
			return false;
		}

		// Swap-rename. fs.rename onto an existing non-empty dir fails on
		// Linux and behaves inconsistently on Windows, so we never rename
		// onto a live target: move any stale modelDir aside first.
		const aside = `${modelDir}.${suffix}.old`;
		let asideUsed = false;
		if (await pathExists(modelDir)) {
			await rename(modelDir, aside);
			asideUsed = true;
		}
		try {
			await rename(extractDir, modelDir);
			extractDir = null;
		} catch (err) {
			// Best effort: try to restore the aside dir before failing.
			if (asideUsed) {
				try {
					await rename(aside, modelDir);
				} catch {
					// Both gone now; nothing more to do.
				}
			}
			throw err;
		}
		if (asideUsed) {
			await rm(aside, { recursive: true, force: true }).catch(() => {});
		}

		await unlink(archivePath).catch(() => {});
		archivePath = null;

		logger.info(`model ${modelName} installed (schema ${schema})`);
		return true;
	} catch (err) {
		logger.warn(
			`failed to download model ${modelName}: ${err instanceof Error ? err.message : String(err)}`,
		);
		return false;
	} finally {
		if (extractDir) {
			await rm(extractDir, { recursive: true, force: true }).catch(() => {});
		}
		if (archivePath) {
			await unlink(archivePath).catch(() => {});
		}
		await unlink(lockPath).catch(() => {});
	}
}

async function streamFetchToFile(
	url: string,
	destPath: string,
	fetchImpl: typeof fetch = fetch,
): Promise<void> {
	const response = await fetchImpl(url);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} from ${url}`);
	}
	if (!response.body) {
		throw new Error(`empty response body from ${url}`);
	}
	// Node 18+ Response.body is a web ReadableStream — convert to a Node stream.
	const nodeStream = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
	await pipeline(nodeStream, createWriteStream(destPath));
}

async function sha256OfFile(path: string): Promise<string> {
	const hash = createHash("sha256");
	const buf = await readFile(path);
	hash.update(buf);
	return hash.digest("hex");
}

async function extractTarGz(archivePath: string, destDir: string): Promise<void> {
	// Imported dynamically so test harnesses that exercise other code paths
	// don't pay the import cost — and because the dep is only listed in
	// `@gendigital/sage-core` (consumers might tree-shake it out).
	const tarMod = (await import("tar")) as unknown as {
		extract?: (opts: { file: string; cwd: string; strip?: number }) => Promise<void>;
		x?: (opts: { file: string; cwd: string; strip?: number }) => Promise<void>;
	};
	const extract = tarMod.extract ?? tarMod.x;
	if (typeof extract !== "function") {
		throw new Error("`tar` package missing extract function");
	}
	await extract({ file: archivePath, cwd: destDir, strip: 1 });
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

function fileExistsSync(path: string): boolean {
	try {
		statSync(path);
		return true;
	} catch {
		return false;
	}
}

async function tryAcquireLock(lockPath: string, logger: Logger): Promise<boolean> {
	try {
		const payload = JSON.stringify({ pid: process.pid, ts: Date.now() });
		await writeFile(lockPath, payload, { flag: "wx" });
		return true;
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		if (code !== "EEXIST") {
			logger.debug(`lock create failed (${code ?? "unknown"}): ${err}`);
			return false;
		}
	}

	// Lock exists — check staleness.
	try {
		const raw = await readFile(lockPath, "utf-8");
		const parsed = JSON.parse(raw) as { pid?: number; ts?: number };
		const age = Date.now() - (parsed.ts ?? 0);
		if (age > STALE_LOCK_MS) {
			await unlink(lockPath).catch(() => {});
			try {
				const payload = JSON.stringify({ pid: process.pid, ts: Date.now() });
				await writeFile(lockPath, payload, { flag: "wx" });
				return true;
			} catch {
				return false;
			}
		}
	} catch {
		// Unparseable / unreadable lock — treat as held by someone alive.
	}
	return false;
}

// Helper used by the worker to land a fresh staging dir on each download.
export async function makeStagingSubdir(sageDir?: string): Promise<string> {
	const root = getDownloadStagingDir(sageDir);
	await mkdir(root, { recursive: true });
	return mkdtemp(join(root, "stage-"));
}
