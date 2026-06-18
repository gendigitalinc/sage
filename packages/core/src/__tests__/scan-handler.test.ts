import { beforeEach, describe, expect, it, vi } from "vitest";

const { runSessionStart } = vi.hoisted(() => ({ runSessionStart: vi.fn() }));

vi.mock("../session-start.js", () => ({ runSessionStart }));

import { createScanHandler, runPluginScan } from "../scan-handler.js";
import type { Logger } from "../types.js";

const logger: Logger = {
	debug: () => {},
	info: () => {},
	warn: () => {},
	error: () => {},
};

beforeEach(() => {
	runSessionStart.mockReset().mockResolvedValue({ scanResults: [], versionCheck: null });
});

describe("runPluginScan", () => {
	it("threads the trailing agentRuntimeVersion through to runSessionStart", async () => {
		await runPluginScan(
			logger,
			"session",
			[],
			"/threats",
			"/allow",
			"0.10.0",
			"claude-code",
			undefined,
			undefined,
			undefined,
			"2.1.150",
		);

		expect(runSessionStart).toHaveBeenCalledWith(
			expect.objectContaining({ agentRuntime: "claude-code", agentRuntimeVersion: "2.1.150" }),
		);
	});

	it("omitting agentRuntimeVersion (no source) forwards undefined without throwing", async () => {
		await runPluginScan(logger, "session", [], "/threats", "/allow", "0.10.0", "openclaw");

		expect(runSessionStart).toHaveBeenCalledWith(
			expect.objectContaining({ agentRuntime: "openclaw", agentRuntimeVersion: undefined }),
		);
	});
});

describe("createScanHandler", () => {
	it("passes agentRuntimeVersion from options into the scan", async () => {
		const handler = createScanHandler({
			logger,
			context: "activation",
			discoverPlugins: async () => [],
			selfPrefix: "self@",
			threatsDir: "/threats",
			allowlistsDir: "/allow",
			version: "0.10.0",
			agentRuntime: "cursor",
			agentRuntimeVersion: "3.6.31",
		});

		await handler();

		expect(runSessionStart).toHaveBeenCalledWith(
			expect.objectContaining({ agentRuntime: "cursor", agentRuntimeVersion: "3.6.31" }),
		);
	});
});
