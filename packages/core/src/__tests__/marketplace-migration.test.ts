import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatMigrationNotice } from "../format.js";
import { needsMarketplaceMigration } from "../marketplace-migration.js";

describe("needsMarketplaceMigration", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "sage-migration-test-"));
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	it("returns true when old avast/sage URL is present", async () => {
		const filePath = join(tmpDir, "known_marketplaces.json");
		await writeFile(
			filePath,
			JSON.stringify([{ source: { url: "https://github.com/avast/sage.git" } }]),
		);
		expect(await needsMarketplaceMigration(filePath)).toBe(true);
	});

	it("returns false when new gendigitalinc/sage URL is present", async () => {
		const filePath = join(tmpDir, "known_marketplaces.json");
		await writeFile(
			filePath,
			JSON.stringify([{ source: { url: "https://github.com/gendigitalinc/sage.git" } }]),
		);
		expect(await needsMarketplaceMigration(filePath)).toBe(false);
	});

	it("returns false when file does not exist", async () => {
		const filePath = join(tmpDir, "nonexistent.json");
		expect(await needsMarketplaceMigration(filePath)).toBe(false);
	});

	it("returns false when file contains invalid JSON", async () => {
		const filePath = join(tmpDir, "known_marketplaces.json");
		await writeFile(filePath, "not json");
		expect(await needsMarketplaceMigration(filePath)).toBe(false);
	});

	it("returns false when file contains non-array JSON", async () => {
		const filePath = join(tmpDir, "known_marketplaces.json");
		await writeFile(filePath, JSON.stringify({ source: { url: "avast/sage" } }));
		expect(await needsMarketplaceMigration(filePath)).toBe(false);
	});

	it("returns false when entries have no source field", async () => {
		const filePath = join(tmpDir, "known_marketplaces.json");
		await writeFile(filePath, JSON.stringify([{ name: "sage" }]));
		expect(await needsMarketplaceMigration(filePath)).toBe(false);
	});
});

describe("formatMigrationNotice", () => {
	it("contains the new GitHub URL", () => {
		const msg = formatMigrationNotice();
		expect(msg).toContain("gendigitalinc/sage");
	});

	it("contains removal and re-add instructions", () => {
		const msg = formatMigrationNotice();
		expect(msg).toContain("/plugin marketplace remove sage");
		expect(msg).toContain("/plugin marketplace add");
	});
});
