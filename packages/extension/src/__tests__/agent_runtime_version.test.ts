import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const vscodeMock = vi.hoisted(() => ({
	env: { appRoot: "" },
	version: "1.117.0-insider",
}));

vi.mock("vscode", () => vscodeMock);

import { resolveAgentRuntimeVersion } from "../agent_runtime_version.js";

describe("resolveAgentRuntimeVersion", () => {
	let appRoot: string;

	beforeEach(async () => {
		appRoot = await mkdtemp(path.join(tmpdir(), "sage-app-root-"));
		vscodeMock.env.appRoot = appRoot;
		vscodeMock.version = "1.117.0-insider";
	});

	afterEach(async () => {
		await rm(appRoot, { recursive: true, force: true });
	});

	it("for cursor, reads the version field from product.json at vscode.env.appRoot", async () => {
		await writeFile(
			path.join(appRoot, "product.json"),
			JSON.stringify({ nameShort: "Cursor", version: "3.1.14" }),
			"utf8",
		);

		expect(resolveAgentRuntimeVersion("cursor")).toBe("3.1.14");
	});

	it("for cursor, returns 'unknown' rather than vscode.version when product.json is missing", () => {
		// Misleading fallback (vscode.version returns the engine version baked into
		// Cursor's Electron shell, not the Cursor version) is explicitly avoided.
		expect(resolveAgentRuntimeVersion("cursor")).toBe("unknown");
	});

	it("for vscode, returns vscode.version directly", () => {
		expect(resolveAgentRuntimeVersion("vscode")).toBe("1.117.0-insider");
	});

	it("for vscode, returns 'unknown' when vscode.version is empty", () => {
		vscodeMock.version = "";
		expect(resolveAgentRuntimeVersion("vscode")).toBe("unknown");
	});

	it("returns 'unknown' for unsupported runtimes", () => {
		expect(resolveAgentRuntimeVersion("claude-code")).toBe("unknown");
		expect(resolveAgentRuntimeVersion("anything-else")).toBe("unknown");
	});
});
