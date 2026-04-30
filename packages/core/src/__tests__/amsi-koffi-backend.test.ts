import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Block PowerShell fallback so tests only exercise the koffi path.
vi.mock("../clients/amsi-spawn.js", () => ({
	spawn: vi.fn(() => {
		throw new Error("spawn blocked in koffi backend test");
	}),
}));

/**
 * Mock koffi module that tracks all AMSI function calls.
 * Verifies per-scan session lifecycle and library cleanup.
 */
function createKoffiMock(
	opts: {
		initHr?: number;
		scanBufferHr?: number;
		/** If true, scanBuffer throws instead of returning an HRESULT. */
		scanBufferThrows?: boolean;
		/** HRESULT for AmsiOpenSession. Can be a number (constant) or a function
		 *  receiving the 1-based call index to fail selectively (e.g. succeed on
		 *  the validation call but fail on scan calls). */
		openSessionHr?: number | ((callIndex: number) => number);
	} = {},
) {
	const { initHr = 0, scanBufferHr = 0, scanBufferThrows = false, openSessionHr = 0 } = opts;
	const calls: { fn: string; args?: unknown[] }[] = [];
	let sessionCounter = 0;
	let openSessionCallIndex = 0;

	const lib = {
		func: vi.fn((signature: string) => {
			if (signature.includes("AmsiInitialize")) {
				return (...args: unknown[]) => {
					calls.push({ fn: "AmsiInitialize" });
					if (initHr === 0) {
						const ctxOut = args[1] as unknown[];
						ctxOut[0] = "mock-context";
					}
					return initHr;
				};
			}
			if (signature.includes("AmsiOpenSession")) {
				return (...args: unknown[]) => {
					openSessionCallIndex++;
					const hr =
						typeof openSessionHr === "function"
							? openSessionHr(openSessionCallIndex)
							: openSessionHr;
					calls.push({ fn: "AmsiOpenSession" });
					if (hr === 0) {
						const sessOut = args[1] as unknown[];
						sessOut[0] = `mock-session-${++sessionCounter}`;
					}
					return hr;
				};
			}
			if (signature.includes("AmsiScanBuffer")) {
				return (...args: unknown[]) => {
					const session = args[4];
					calls.push({ fn: "AmsiScanBuffer", args: [session] });
					if (scanBufferThrows) {
						throw new Error("koffi native call failed");
					}
					if (scanBufferHr === 0) {
						const resultOut = args[5] as number[];
						resultOut[0] = 0; // clean
					}
					return scanBufferHr;
				};
			}
			if (signature.includes("AmsiCloseSession")) {
				return (...args: unknown[]) => {
					const session = args[1];
					calls.push({ fn: "AmsiCloseSession", args: [session] });
				};
			}
			if (signature.includes("AmsiUninitialize")) {
				return () => {
					calls.push({ fn: "AmsiUninitialize" });
				};
			}
			return vi.fn();
		}),
		close: vi.fn(() => {
			calls.push({ fn: "lib.close" });
		}),
	};

	const koffi = {
		load: vi.fn(() => lib),
		pointer: vi.fn(() => "opaque-type"),
		opaque: vi.fn(() => "opaque"),
	};

	return { koffi, lib, calls, getSessionCounter: () => sessionCounter };
}

// Dynamic koffi mock — each test configures its own instance
let koffiMock: ReturnType<typeof createKoffiMock>;

vi.mock("koffi", () => {
	// Return a module whose default export is our mock
	return {
		get default() {
			return koffiMock.koffi;
		},
	};
});

import { AmsiClient } from "../clients/amsi.js";
import { nullLogger } from "../types.js";

describe("KoffiAmsiBackend session lifecycle", () => {
	beforeEach(() => {
		koffiMock = createKoffiMock();
		vi.spyOn(process, "platform", "get").mockReturnValue("win32" as NodeJS.Platform);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("opens and closes a session per scan, not one shared session", async () => {
		const client = new AmsiClient(nullLogger);
		await client.init();
		expect(client.isAvailable).toBe(true);

		// Two scans
		await client.scanString("Bash", "file-a", "content a");
		await client.scanString("Bash", "file-b", "content b");

		const { calls } = koffiMock;
		const openCalls = calls.filter((c) => c.fn === "AmsiOpenSession");
		const closeCalls = calls.filter((c) => c.fn === "AmsiCloseSession");
		const scanCalls = calls.filter((c) => c.fn === "AmsiScanBuffer");

		// init opens+closes a validation session, then each scan opens+closes its own
		expect(openCalls).toHaveLength(3); // 1 init + 2 scans
		expect(closeCalls).toHaveLength(3); // 1 init + 2 scans
		expect(scanCalls).toHaveLength(2);

		// Each scan used a different session handle
		expect(scanCalls[0].args?.[0]).toBe("mock-session-2");
		expect(scanCalls[1].args?.[0]).toBe("mock-session-3");

		client.close();
	});

	it("closes session even when scanBuffer fails", async () => {
		// Configure scanBuffer to fail from the start so the function
		// captured during init() already has the failing behavior.
		koffiMock = createKoffiMock({ scanBufferHr: 0x80070057 });

		const client = new AmsiClient(nullLogger);
		await client.init();
		expect(client.isAvailable).toBe(true);

		const result = await client.scanString("Bash", "fail-test", "content");
		expect(result).toBeNull();

		const { calls } = koffiMock;
		const closeCalls = calls.filter((c) => c.fn === "AmsiCloseSession");
		// init validation session + the failed scan's session should both be closed
		expect(closeCalls).toHaveLength(2);

		client.close();
	});

	it("calls lib.close() on close to release the DLL handle", async () => {
		const client = new AmsiClient(nullLogger);
		await client.init();
		expect(client.isAvailable).toBe(true);

		client.close();

		const { calls } = koffiMock;
		expect(calls.some((c) => c.fn === "AmsiUninitialize")).toBe(true);
		expect(calls.some((c) => c.fn === "lib.close")).toBe(true);

		// lib.close should come after AmsiUninitialize
		const uninitIdx = calls.findIndex((c) => c.fn === "AmsiUninitialize");
		const libCloseIdx = calls.findIndex((c) => c.fn === "lib.close");
		expect(libCloseIdx).toBeGreaterThan(uninitIdx);
	});

	it("calls lib.close() even when init fails at AmsiInitialize", async () => {
		koffiMock = createKoffiMock({ initHr: 0x80070005 });

		const client = new AmsiClient(nullLogger);
		await client.init();
		// Koffi fails, PowerShell fallback may or may not succeed — either way,
		// the koffi lib handle must have been closed.
		const { calls } = koffiMock;
		expect(calls.some((c) => c.fn === "lib.close")).toBe(true);
	});

	it("returns null when AmsiOpenSession fails during scan", async () => {
		// Validation session (call 1) succeeds, scan sessions fail.
		koffiMock = createKoffiMock({
			openSessionHr: (callIndex) => (callIndex === 1 ? 0 : 0x80070005),
		});

		const client = new AmsiClient(nullLogger);
		await client.init();
		expect(client.isAvailable).toBe(true);

		const result = await client.scanString("Bash", "test", "content");
		expect(result).toBeNull();

		// No scan or close-session call should have happened for the failed scan
		const { calls } = koffiMock;
		expect(calls.filter((c) => c.fn === "AmsiScanBuffer")).toHaveLength(0);
		// Only the init validation session was closed
		const scanSessionCloses = calls.filter(
			(c) => c.fn === "AmsiCloseSession" && c.args?.[0] !== "mock-session-1",
		);
		expect(scanSessionCloses).toHaveLength(0);

		client.close();
	});

	it("closes session when scanBuffer throws an exception", async () => {
		koffiMock = createKoffiMock({ scanBufferThrows: true });

		const client = new AmsiClient(nullLogger);
		await client.init();
		expect(client.isAvailable).toBe(true);

		const result = await client.scanString("Bash", "throw-test", "content");
		expect(result).toBeNull();

		// The session opened for this scan must still be closed (finally block)
		const { calls } = koffiMock;
		const closeCalls = calls.filter((c) => c.fn === "AmsiCloseSession");
		expect(closeCalls).toHaveLength(2); // 1 init + 1 scan
	});

	it("cleans up when validation session open fails during init", async () => {
		// All AmsiOpenSession calls fail — init validation session included.
		koffiMock = createKoffiMock({ openSessionHr: 0x80004005 });

		const client = new AmsiClient(nullLogger);
		await client.init();
		expect(client.isAvailable).toBe(false);

		const { calls } = koffiMock;
		// close() should have been called, releasing the lib
		expect(calls.some((c) => c.fn === "AmsiUninitialize")).toBe(true);
		expect(calls.some((c) => c.fn === "lib.close")).toBe(true);
	});

	it("double close() is idempotent and does not throw", async () => {
		const client = new AmsiClient(nullLogger);
		await client.init();
		expect(client.isAvailable).toBe(true);

		client.close();
		expect(client.isAvailable).toBe(false);

		// Second close should not throw or double-call native functions
		const callsBefore = koffiMock.calls.length;
		expect(() => client.close()).not.toThrow();
		// No additional native calls (context/lib are already null)
		expect(koffiMock.calls.length).toBe(callsBefore);
	});

	it("nulls function references after close so GC can collect them", async () => {
		const client = new AmsiClient(nullLogger);
		await client.init();
		expect(client.isAvailable).toBe(true);

		client.close();
		expect(client.isAvailable).toBe(false);

		// Subsequent scan should return null, not throw
		const result = await client.scanString("Bash", "after-close", "content");
		expect(result).toBeNull();
	});
});
