import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOperationalLogger } from "../operational-log.js";
import type { OperationalLoggingConfig } from "../types.js";

const appendJsonlEntryMock = vi.hoisted(() => vi.fn());

vi.mock("../jsonl-log-writer.js", () => ({
	appendJsonlEntry: appendJsonlEntryMock,
}));

function makeConfig(): OperationalLoggingConfig {
	return {
		enabled: true,
		level: "info",
		path: "/tmp/sage-operational.jsonl",
		max_bytes: 5 * 1024 * 1024,
		max_files: 3,
	};
}

describe("operational log flush timeout", () => {
	beforeEach(() => {
		appendJsonlEntryMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns when pending writes do not settle", async () => {
		vi.useFakeTimers();
		appendJsonlEntryMock.mockImplementation(() => new Promise<void>(() => {}));
		const logger = createOperationalLogger(makeConfig(), "cursor").forComponent("evaluator");

		logger.info("stuck write");
		const flush = logger.flush?.();

		await vi.advanceTimersByTimeAsync(1000);
		await expect(flush).resolves.toBeUndefined();
		expect(appendJsonlEntryMock).toHaveBeenCalledOnce();
	});

	it("component loggers share pending writes and flush state", async () => {
		const resolveWrites: Array<() => void> = [];
		appendJsonlEntryMock.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveWrites.push(resolve);
				}),
		);
		const operationalLogger = createOperationalLogger(makeConfig(), "opencode");
		const pluginLogger = operationalLogger.forComponent("plugin");
		const toolLogger = operationalLogger.forComponent("tool-handler");

		pluginLogger.info("plugin ready");
		toolLogger.warn("tool warning");

		const flush = pluginLogger.flush?.();
		expect(flush).toBeDefined();

		let flushed = false;
		void flush?.then(() => {
			flushed = true;
		});
		await Promise.resolve();
		expect(flushed).toBe(false);

		for (const resolve of resolveWrites) resolve();

		await flush;
		expect(flushed).toBe(true);
	});
});
