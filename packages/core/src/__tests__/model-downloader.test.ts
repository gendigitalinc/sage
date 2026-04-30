import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import * as tar from "tar";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { downloadModel } from "../clients/model-downloader.js";
import {
	getDownloadStagingDir,
	getModelDir,
	isModelPresent,
	requiredModelFiles,
} from "../model-storage.js";

let sageDir: string;

beforeEach(() => {
	sageDir = mkdtempSync(join(tmpdir(), "sage-dl-"));
});

afterEach(() => {
	rmSync(sageDir, { recursive: true, force: true });
});

/**
 * Build a tarball whose content matches `requiredModelFiles("pi-model")`.
 * The archive is laid out one level deep (`<root>/<files>`) so the
 * downloader's `strip: 1` extraction lands the files directly in the
 * model directory — matching the production layout.
 */
async function buildModelTarball(): Promise<Buffer> {
	const work = mkdtempSync(join(tmpdir(), "sage-tar-"));
	const inner = join(work, "pi-model");
	mkdirSync(inner, { recursive: true });
	for (const f of requiredModelFiles("pi-model")) {
		writeFileSync(join(inner, f), `stub:${f}`);
	}

	const out = join(work, "archive.tar.gz");
	await tar.create({ gzip: true, cwd: work, file: out }, ["pi-model"]);
	const fs = await import("node:fs/promises");
	const buf = await fs.readFile(out);
	rmSync(work, { recursive: true, force: true });
	return buf;
}

function sha256(buf: Buffer): string {
	return createHash("sha256").update(buf).digest("hex");
}

function fetchReturning(buf: Buffer): typeof fetch {
	return (async () => {
		const stream = Readable.toWeb(Readable.from(buf));
		return new Response(stream as unknown as BodyInit, { status: 200 });
	}) as unknown as typeof fetch;
}

describe("downloadModel", () => {
	it("happy path: extracts archive and deletes source tarball", async () => {
		const archive = await buildModelTarball();
		const ok = await downloadModel({
			modelName: "pi-model",
			entry: { url: "https://example.com/pi-model.tar.gz", sha256: sha256(archive) },
			schema: "v1",
			sageDir,
			fetchImpl: fetchReturning(archive),
		});
		expect(ok).toBe(true);
		expect(isModelPresent("pi-model", "v1", sageDir)).toBe(true);

		// No .tar.gz left in the staging dir.
		const staging = getDownloadStagingDir(sageDir);
		const leftovers = existsSync(staging)
			? readdirSync(staging).filter((f) => f.endsWith(".tar.gz"))
			: [];
		expect(leftovers).toEqual([]);

		// Lock file is cleaned up.
		expect(existsSync(`${getModelDir("pi-model", "v1", sageDir)}.lock`)).toBe(false);
	});

	it("missing sha256 in entry: no fetch attempted", async () => {
		let fetchCalls = 0;
		const ok = await downloadModel({
			modelName: "pi-model",
			entry: { url: "https://example.com/x.tar.gz", sha256: "" },
			schema: "v1",
			sageDir,
			fetchImpl: (async () => {
				fetchCalls++;
				throw new Error("fetch should not be called");
			}) as unknown as typeof fetch,
		});
		expect(ok).toBe(false);
		expect(fetchCalls).toBe(0);
		expect(isModelPresent("pi-model", "v1", sageDir)).toBe(false);
	});

	it("sha256 mismatch: archive deleted, modelDir not created", async () => {
		const archive = await buildModelTarball();
		const ok = await downloadModel({
			modelName: "pi-model",
			entry: { url: "https://example.com/x.tar.gz", sha256: "0".repeat(64) },
			schema: "v1",
			sageDir,
			fetchImpl: fetchReturning(archive),
		});
		expect(ok).toBe(false);
		expect(isModelPresent("pi-model", "v1", sageDir)).toBe(false);

		const staging = getDownloadStagingDir(sageDir);
		const leftovers = existsSync(staging)
			? readdirSync(staging).filter((f) => f.endsWith(".tar.gz"))
			: [];
		expect(leftovers).toEqual([]);
	});

	it("re-entrant: returns true without fetching when modelDir already populated", async () => {
		const dir = getModelDir("pi-model", "v1", sageDir);
		mkdirSync(dir, { recursive: true });
		for (const f of requiredModelFiles("pi-model")) {
			writeFileSync(join(dir, f), "stub");
		}

		let fetchCalls = 0;
		const ok = await downloadModel({
			modelName: "pi-model",
			entry: { url: "https://example.com/x.tar.gz", sha256: "abc" },
			schema: "v1",
			sageDir,
			fetchImpl: (async () => {
				fetchCalls++;
				throw new Error("should not be called");
			}) as unknown as typeof fetch,
		});
		expect(ok).toBe(true);
		expect(fetchCalls).toBe(0);
	});
});
