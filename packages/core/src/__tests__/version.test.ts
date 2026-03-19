import { describe, expect, it } from "vitest";
import { VERSION } from "../version.js";

describe("VERSION", () => {
	it("resolves to a semver string from package.json (not 'dev')", () => {
		expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
		expect(VERSION).not.toBe("dev");
	});
});
