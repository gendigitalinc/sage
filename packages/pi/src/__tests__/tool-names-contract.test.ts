/**
 * Tool-name drift contract for the pi connector (Layer 1).
 *
 * pi names its tools (`bash`, `grep`, `url_context`, …); `extractors.ts` maps
 * those raw names to Sage's canonical tool types via PI_TOOL_MAP. Those map
 * keys are Sage's tool-name dependency surface: if pi renames a tool, drops
 * one, or adds one we should guard, the map silently stops matching and Sage
 * goes blind for that tool.
 *
 * This pins the map against a committed snapshot so any add/remove/rename is
 * a conscious fixture update. Mirrors the OpenCode contract test.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PI_TOOL_MAP } from "../extractors.js";

const FIXTURE = JSON.parse(
	readFileSync(resolve(__dirname, "fixtures", "contract", "tool-names.json"), "utf-8"),
) as { pi: Record<string, string> };

describe("pi tool-name contract", () => {
	it("PI_TOOL_MAP matches the committed snapshot", () => {
		expect(PI_TOOL_MAP).toEqual(FIXTURE.pi);
	});
});
