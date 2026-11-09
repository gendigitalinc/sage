/**
 * Host registration contract.
 *
 * pi discovers extensions from the `pi.extensions` field. If that entry is
 * dropped or pointed at a file the build no longer emits, the connector
 * installs and then never loads. Pin it here so a packaging change is a
 * conscious fixture update, same idea as the tool-name contract.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("pi registration contract", () => {
	it("declares the bundled extension entry pi loads", () => {
		const pkg = JSON.parse(readFileSync(resolve(__dirname, "..", "..", "package.json"), "utf-8"));
		expect(pkg.pi?.extensions).toEqual(["./dist/index.cjs"]);
		expect(pkg.files).toEqual(expect.arrayContaining(["dist/**", "resources/**"]));
	});
});
