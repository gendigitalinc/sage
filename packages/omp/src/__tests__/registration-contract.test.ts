/**
 * Host registration contract.
 *
 * OMP loads this connector via an explicit `--hook` path at `dist/index.cjs`
 * (native discovery ignores `.cjs`). Pin the package entry so a packaging
 * change cannot silently point the hook at a file the build no longer emits.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("omp registration contract", () => {
	it("exports the bundled hook factory the --hook path loads", () => {
		const pkg = JSON.parse(readFileSync(resolve(__dirname, "..", "..", "package.json"), "utf-8"));
		expect(pkg.main).toBe("./dist/index.cjs");
		expect(pkg.exports?.["."]).toBe("./dist/index.cjs");
		expect(pkg.files).toEqual(expect.arrayContaining(["dist/**", "resources/**"]));
	});
});
