import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	checkAllowlistMigration,
	formatAllowlistMigrationWarning,
} from "../allowlist-migration.js";

vi.mock("../file-utils.js", async (importOriginal) => {
	const original = (await importOriginal()) as Record<string, unknown>;
	return { ...original, getFileContent: vi.fn() };
});

import { getFileContent } from "../file-utils.js";

const mockGetFileContent = vi.mocked(getFileContent);

describe("checkAllowlistMigration", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("returns needed:false when file does not exist", async () => {
		mockGetFileContent.mockRejectedValue(new Error("ENOENT"));
		expect(await checkAllowlistMigration()).toEqual({ needed: false, entryTypes: [] });
	});

	it("returns needed:false for empty JSON object", async () => {
		mockGetFileContent.mockResolvedValue(
			JSON.stringify({ urls: {}, commands: {}, file_paths: {} }),
		);
		expect(await checkAllowlistMigration()).toEqual({ needed: false, entryTypes: [] });
	});

	it("returns needed:false for malformed JSON", async () => {
		mockGetFileContent.mockResolvedValue("not json");
		expect(await checkAllowlistMigration()).toEqual({ needed: false, entryTypes: [] });
	});

	it("returns needed:false for non-object JSON", async () => {
		mockGetFileContent.mockResolvedValue(JSON.stringify(["entry"]));
		expect(await checkAllowlistMigration()).toEqual({ needed: false, entryTypes: [] });
	});

	it("detects urls entries", async () => {
		mockGetFileContent.mockResolvedValue(
			JSON.stringify({
				urls: {
					"https://example.com": {
						added_at: "2024-01-01",
						reason: "test",
						original_verdict: "deny",
					},
				},
				commands: {},
				file_paths: {},
			}),
		);
		expect(await checkAllowlistMigration()).toEqual({ needed: true, entryTypes: ["urls"] });
	});

	it("detects commands entries", async () => {
		mockGetFileContent.mockResolvedValue(
			JSON.stringify({
				urls: {},
				commands: { abc123: { added_at: "2024-01-01", reason: "test", original_verdict: "deny" } },
				file_paths: {},
			}),
		);
		expect(await checkAllowlistMigration()).toEqual({ needed: true, entryTypes: ["commands"] });
	});

	it("detects multiple entry types", async () => {
		mockGetFileContent.mockResolvedValue(
			JSON.stringify({
				urls: {
					"https://example.com": {
						added_at: "2024-01-01",
						reason: "test",
						original_verdict: "deny",
					},
				},
				commands: { abc123: { added_at: "2024-01-01", reason: "test", original_verdict: "deny" } },
				file_paths: {},
			}),
		);
		expect(await checkAllowlistMigration()).toEqual({
			needed: true,
			entryTypes: ["urls", "commands"],
		});
	});
});

describe("formatAllowlistMigrationWarning", () => {
	it("includes entry types in the message", () => {
		const msg = formatAllowlistMigrationWarning(["urls", "commands"]);
		expect(msg).toContain("urls, commands");
	});

	it("mentions exceptions.json as migration target", () => {
		const msg = formatAllowlistMigrationWarning(["urls"]);
		expect(msg).toContain("exceptions.json");
	});

	it("mentions that command entries cannot be recovered", () => {
		const msg = formatAllowlistMigrationWarning(["commands"]);
		expect(msg).toContain("cannot be recovered");
	});

	it("uses branding name when provided", () => {
		const msg = formatAllowlistMigrationWarning(["urls"], {
			name: "Norton Sage",
			short_name: "Sage",
		});
		expect(msg).toContain("Norton Sage:");
	});
});
