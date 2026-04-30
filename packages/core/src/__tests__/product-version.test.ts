import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readProductJsonVersion } from "../product-version.js";
import { makeTmpDir } from "./test-utils.js";

describe("readProductJsonVersion", () => {
	it("returns the top-level version field when product.json is well-formed", async () => {
		const appRoot = await makeTmpDir();
		await writeFile(
			path.join(appRoot, "product.json"),
			JSON.stringify({ nameShort: "Cursor", applicationName: "cursor", version: "3.1.14" }),
			"utf8",
		);

		expect(readProductJsonVersion(appRoot)).toBe("3.1.14");
	});

	it("returns the VS Code-style version (e.g. insider build) verbatim", async () => {
		const appRoot = await makeTmpDir();
		await writeFile(
			path.join(appRoot, "product.json"),
			JSON.stringify({ nameShort: "Code - Insiders", version: "1.117.0-insider" }),
			"utf8",
		);

		expect(readProductJsonVersion(appRoot)).toBe("1.117.0-insider");
	});

	it("returns 'unknown' when appRoot is empty", () => {
		expect(readProductJsonVersion("")).toBe("unknown");
	});

	it("returns 'unknown' when product.json is missing", async () => {
		const appRoot = await makeTmpDir();
		expect(readProductJsonVersion(appRoot)).toBe("unknown");
	});

	it("returns 'unknown' when product.json is not valid JSON", async () => {
		const appRoot = await makeTmpDir();
		await writeFile(path.join(appRoot, "product.json"), "{ not json", "utf8");

		expect(readProductJsonVersion(appRoot)).toBe("unknown");
	});

	it("returns 'unknown' when the version field is missing", async () => {
		const appRoot = await makeTmpDir();
		await writeFile(
			path.join(appRoot, "product.json"),
			JSON.stringify({ nameShort: "Cursor" }),
			"utf8",
		);

		expect(readProductJsonVersion(appRoot)).toBe("unknown");
	});

	it("returns 'unknown' when the version field is not a string", async () => {
		const appRoot = await makeTmpDir();
		await writeFile(path.join(appRoot, "product.json"), JSON.stringify({ version: 311 }), "utf8");

		expect(readProductJsonVersion(appRoot)).toBe("unknown");
	});

	it("returns 'unknown' when the version field is an empty string", async () => {
		const appRoot = await makeTmpDir();
		await writeFile(path.join(appRoot, "product.json"), JSON.stringify({ version: "" }), "utf8");

		expect(readProductJsonVersion(appRoot)).toBe("unknown");
	});

	it("returns 'unknown' when product.json top level is not an object", async () => {
		const appRoot = await makeTmpDir();
		await writeFile(path.join(appRoot, "product.json"), JSON.stringify("3.1.14"), "utf8");

		expect(readProductJsonVersion(appRoot)).toBe("unknown");
	});
});
