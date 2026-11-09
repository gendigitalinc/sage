/**
 * Tool-name drift contract for the OMP connector (Layer 1).
 *
 * OMP names its tools (`bash`, `ast_edit`, `eval`, …); `extractors.ts` maps
 * the guarded ones to Sage's canonical tool types via OMP_TOOL_MAP. The map
 * is the covered set: a rename or a newly guarded tool is a conscious fixture
 * update. Tools listed as intentionally unguarded must stay out of the map,
 * so adding coverage is also a conscious fixture update.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OMP_TOOL_MAP } from "../extractors.js";

const FIXTURE = JSON.parse(
	readFileSync(resolve(__dirname, "fixtures", "contract", "tool-names.json"), "utf-8"),
) as { omp: Record<string, string>; intentionallyUnguarded: string[] };

describe("omp tool-name contract", () => {
	it("OMP_TOOL_MAP matches the committed covered set", () => {
		expect(OMP_TOOL_MAP).toEqual(FIXTURE.omp);
	});

	it("intentionally unguarded tools are not in the covered set", () => {
		for (const name of FIXTURE.intentionallyUnguarded) {
			expect(OMP_TOOL_MAP).not.toHaveProperty(name);
		}
	});
});
