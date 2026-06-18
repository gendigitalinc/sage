import { describe, expect, it, vi } from "vitest";
import type { Logger } from "../types.js";

function makeLogger(): Logger {
	return {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	};
}

describe("applyPolicy", () => {
	const importPolicy = () => import("../policy.js");

	const denyThreshold = 0.85;
	const askThreshold = 0.5;

	it("below askThreshold → allow", async () => {
		const { applyPolicy } = await importPolicy();
		expect(applyPolicy(0.3, denyThreshold, askThreshold)).toBe("allow");
	});

	it("just below askThreshold → allow", async () => {
		const { applyPolicy } = await importPolicy();
		expect(applyPolicy(0.49, denyThreshold, askThreshold)).toBe("allow");
	});

	it("at askThreshold → ask", async () => {
		const { applyPolicy } = await importPolicy();
		expect(applyPolicy(0.5, denyThreshold, askThreshold)).toBe("ask");
	});

	it("between thresholds → ask", async () => {
		const { applyPolicy } = await importPolicy();
		expect(applyPolicy(0.7, denyThreshold, askThreshold)).toBe("ask");
	});

	it("just below denyThreshold → ask", async () => {
		const { applyPolicy } = await importPolicy();
		expect(applyPolicy(0.84, denyThreshold, askThreshold)).toBe("ask");
	});

	it("at denyThreshold → deny", async () => {
		const { applyPolicy } = await importPolicy();
		expect(applyPolicy(0.85, denyThreshold, askThreshold)).toBe("deny");
	});

	it("above denyThreshold → deny", async () => {
		const { applyPolicy } = await importPolicy();
		expect(applyPolicy(0.99, denyThreshold, askThreshold)).toBe("deny");
	});

	it("max valid confidence (1.0) → deny", async () => {
		const { applyPolicy } = await importPolicy();
		expect(applyPolicy(1.0, denyThreshold, askThreshold)).toBe("deny");
	});

	it("confidence = 0 → fail-open allow + logs warning", async () => {
		const { applyPolicy } = await importPolicy();
		const logger = makeLogger();
		expect(applyPolicy(0, denyThreshold, askThreshold, logger)).toBe("allow");
		expect(logger.warn).toHaveBeenCalledWith("Invalid confidence; treating as allow", {
			confidence: 0,
		});
	});

	it("confidence < 0 → fail-open allow + logs warning", async () => {
		const { applyPolicy } = await importPolicy();
		const logger = makeLogger();
		expect(applyPolicy(-0.1, denyThreshold, askThreshold, logger)).toBe("allow");
		expect(logger.warn).toHaveBeenCalledWith("Invalid confidence; treating as allow", {
			confidence: -0.1,
		});
	});

	it("confidence > 1 → fail-open allow + logs warning", async () => {
		const { applyPolicy } = await importPolicy();
		const logger = makeLogger();
		expect(applyPolicy(1.01, denyThreshold, askThreshold, logger)).toBe("allow");
		expect(logger.warn).toHaveBeenCalledWith("Invalid confidence; treating as allow", {
			confidence: 1.01,
		});
	});

	it("confidence = NaN → fail-open allow + logs warning", async () => {
		const { applyPolicy } = await importPolicy();
		const logger = makeLogger();
		expect(applyPolicy(NaN, denyThreshold, askThreshold, logger)).toBe("allow");
		expect(logger.warn).toHaveBeenCalledWith("Invalid confidence; treating as allow", {
			confidence: NaN,
		});
	});

	it("invalid confidence with no logger → still fail-open allow (default nullLogger)", async () => {
		const { applyPolicy } = await importPolicy();
		expect(applyPolicy(0, denyThreshold, askThreshold)).toBe("allow");
		expect(applyPolicy(-1, denyThreshold, askThreshold)).toBe("allow");
		expect(applyPolicy(1.5, denyThreshold, askThreshold)).toBe("allow");
	});
});
