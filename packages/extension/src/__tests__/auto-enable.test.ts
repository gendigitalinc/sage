import { describe, expect, it } from "vitest";
import { DISABLE_GRACE_MS, disabledUntilKey, shouldAutoEnable } from "../auto_enable_logic.js";

describe("disabledUntilKey", () => {
	it("builds a scoped key from host and scope", () => {
		expect(disabledUntilKey("Cursor", "user")).toBe("sage.disabledUntil.Cursor.user");
		expect(disabledUntilKey("VS Code", "workspace")).toBe("sage.disabledUntil.VS Code.workspace");
	});
});

describe("shouldAutoEnable", () => {
	const now = 1_000_000;

	it("returns true when never disabled", () => {
		expect(shouldAutoEnable(undefined, now)).toBe(true);
	});

	it("returns true when disabled long before grace period", () => {
		const disabledAt = now - DISABLE_GRACE_MS - 60_000;
		expect(shouldAutoEnable(disabledAt, now)).toBe(true);
	});

	it("returns true when disabled exactly at grace boundary", () => {
		const disabledAt = now - DISABLE_GRACE_MS;
		expect(shouldAutoEnable(disabledAt, now)).toBe(true);
	});

	it("returns false when disabled within grace period", () => {
		const disabledAt = now - DISABLE_GRACE_MS + 1;
		expect(shouldAutoEnable(disabledAt, now)).toBe(false);
	});

	it("returns false when disabled at the same instant", () => {
		expect(shouldAutoEnable(now, now)).toBe(false);
	});
});
