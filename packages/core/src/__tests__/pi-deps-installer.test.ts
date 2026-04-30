import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isLocalInstallValid } from "../clients/pi-deps-installer.js";

let modelPath: string;

beforeEach(() => {
	modelPath = mkdtempSync(join(tmpdir(), "sage-pideps-"));
});

afterEach(() => {
	rmSync(modelPath, { recursive: true, force: true });
});

describe("isLocalInstallValid", () => {
	it("returns true when the package is resolvable", () => {
		const pkgDir = join(modelPath, "node_modules", "onnxruntime-node");
		mkdirSync(join(pkgDir, "dist"), { recursive: true });
		writeFileSync(
			join(pkgDir, "package.json"),
			'{"name":"onnxruntime-node","main":"dist/index.js"}',
		);
		writeFileSync(join(pkgDir, "dist", "index.js"), "");

		expect(isLocalInstallValid(modelPath)).toBe(true);
	});

	it("returns false when node_modules does not exist", () => {
		expect(isLocalInstallValid(modelPath)).toBe(false);
	});

	it("returns false for a bare directory with no package.json", () => {
		const pkgDir = join(modelPath, "node_modules", "onnxruntime-node");
		mkdirSync(pkgDir, { recursive: true });

		expect(isLocalInstallValid(modelPath)).toBe(false);
	});

	it("returns false when package resolves from a sibling path", () => {
		// Simulate a "node_modules-other" sibling that startsWith("node_modules")
		// but is outside the real node_modules boundary
		const siblingDir = join(modelPath, "node_modules-other", "onnxruntime-node");
		mkdirSync(join(siblingDir, "dist"), { recursive: true });
		writeFileSync(
			join(siblingDir, "package.json"),
			'{"name":"onnxruntime-node","main":"dist/index.js"}',
		);
		writeFileSync(join(siblingDir, "dist", "index.js"), "");

		// Create a local package.json that redirects main to the sibling
		const pkgDir = join(modelPath, "node_modules", "onnxruntime-node");
		mkdirSync(pkgDir, { recursive: true });
		writeFileSync(
			join(pkgDir, "package.json"),
			'{"name":"onnxruntime-node","main":"../../node_modules-other/onnxruntime-node/dist/index.js"}',
		);

		expect(isLocalInstallValid(modelPath)).toBe(false);
	});

	it("returns false when package.json exists but entry point is missing", () => {
		const pkgDir = join(modelPath, "node_modules", "onnxruntime-node");
		mkdirSync(pkgDir, { recursive: true });
		writeFileSync(
			join(pkgDir, "package.json"),
			'{"name":"onnxruntime-node","main":"dist/index.js"}',
		);

		expect(isLocalInstallValid(modelPath)).toBe(false);
	});
});
