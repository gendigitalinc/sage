import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { DecisionEngine } from "../engine.js";
import { loadThreats } from "../threat-loader.js";
import type { HeuristicMatch, Threat } from "../types.js";

const THREATS_DIR = resolve(__dirname, "..", "..", "..", "..", "threats");
const FIXTURE_PATH = resolve(__dirname, "fixtures", "decision-snapshot.json");
const SENSITIVITIES = ["paranoid", "balanced", "relaxed"] as const;

function syntheticMatch(threat: Threat): HeuristicMatch {
	return {
		threat,
		artifact: `snapshot:${threat.id}`,
		matchValue: "snapshot",
	};
}

describe("Decision snapshot — golden file", () => {
	let threats: Threat[];
	let actual: Record<string, Record<string, string>>;

	beforeAll(async () => {
		threats = await loadThreats(THREATS_DIR);
		actual = {};
		for (const threat of threats) {
			actual[threat.id] = {};
			for (const sensitivity of SENSITIVITIES) {
				const engine = new DecisionEngine(sensitivity);
				const verdict = await engine.decide({
					heuristicMatches: [syntheticMatch(threat)],
					urlCheckResults: [],
				});
				actual[threat.id][sensitivity] = verdict.decision;
			}
		}
	});

	it("matches the committed fixture", () => {
		if (!existsSync(FIXTURE_PATH) || process.env.UPDATE_DECISION_SNAPSHOT) {
			const data = {
				generatedAt: new Date().toISOString(),
				threatCount: threats.length,
				entries: actual,
			};
			writeFileSync(FIXTURE_PATH, `${JSON.stringify(data, null, 2)}\n`);
			return;
		}
		const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
		expect(actual).toEqual(fixture.entries);
	});

	it("covers all loaded threats", () => {
		expect(Object.keys(actual)).toHaveLength(threats.length);
	});

	it("has entries for all three sensitivities per rule", () => {
		for (const [, decisions] of Object.entries(actual)) {
			expect(Object.keys(decisions)).toEqual(
				expect.arrayContaining(["paranoid", "balanced", "relaxed"]),
			);
		}
	});
});
