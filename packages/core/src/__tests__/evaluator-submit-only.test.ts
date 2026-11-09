import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../detection-telemetry.js", () => ({
	sendCommunityIqTelemetry: vi.fn().mockResolvedValue(undefined),
}));

import { sendCommunityIqTelemetry } from "../detection-telemetry.js";
import { CANARY_MARKERS } from "../e2e-canary-markers.js";
import { evaluateToolCall, evaluateToolOutput } from "../evaluator.js";
import { SUBMIT_WINDOW_MS } from "../submit-limits.js";
import { makeTmpDir, type RestoreEnv, withHomeOverride } from "./test-utils.js";

const sendMock = vi.mocked(sendCommunityIqTelemetry);

const THREATS_DIR = resolve(__dirname, "..", "..", "..", "..", "threats");
const TRUSTED_DOMAINS_DIR = resolve(__dirname, "..", "..", "..", "..", "trusted-domains");
const T0 = 1_700_000_000_000;

async function writeConfig(dir: string, opts: { communityIq?: boolean } = {}): Promise<string> {
	const configPath = join(dir, "config.json");
	await writeFile(
		configPath,
		JSON.stringify({
			heuristics_enabled: true,
			url_check: { enabled: false },
			package_check: { enabled: false },
			cache: { enabled: false },
			logging: { enabled: false },
			pi_check: { enabled: false },
			community_iq: opts.communityIq ?? true,
		}),
	);
	return configPath;
}

async function evalCommand(configPath: string, command: string) {
	return evaluateToolCall(
		{
			sessionId: "submit-only",
			toolName: "Bash",
			toolInput: { command },
			artifacts: [{ type: "command", value: command }],
		},
		{ threatsDir: THREATS_DIR, trustedDomainsDir: TRUSTED_DOMAINS_DIR, configPath },
	);
}

describe("evaluateToolCall submit-only rules", () => {
	let home: string;
	let restoreHome: RestoreEnv;
	let configPath: string;
	let now: number;

	beforeEach(async () => {
		sendMock.mockClear();
		home = await makeTmpDir();
		restoreHome = withHomeOverride(home);
		configPath = await writeConfig(home);
		now = T0;
		vi.spyOn(Date, "now").mockImplementation(() => now);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		restoreHome.restore();
	});

	it("allows the call and sends one non-blocking event, then caps repeats for 24h", async () => {
		const command = `echo ${CANARY_MARKERS.cmdSubmit}`;

		const first = await evalCommand(configPath, command);
		expect(first.decision).toBe("allow");
		expect(sendMock).toHaveBeenCalledOnce();
		const args = sendMock.mock.calls[0]?.[0];
		expect(args?.blocking).toBe(false);
		expect(args?.toolName).toBe("Bash");
		expect(args?.signals?.heuristics?.map((h) => h.rule_id)).toEqual(["DUMMY-CMD-SUBMIT-001"]);

		const state = JSON.parse(await readFile(join(home, ".sage", "submit-limits.json"), "utf8"));
		expect(state.rules["DUMMY-CMD-SUBMIT-001"].last_submitted_ms).toBe(T0);

		// Same rule again within the window: still allowed, no telemetry.
		now = T0 + SUBMIT_WINDOW_MS - 1;
		const second = await evalCommand(configPath, command);
		expect(second.decision).toBe("allow");
		expect(sendMock).toHaveBeenCalledOnce();

		// After 24h the rule may submit again.
		now = T0 + SUBMIT_WINDOW_MS;
		await evalCommand(configPath, command);
		expect(sendMock).toHaveBeenCalledTimes(2);
		expect(sendMock.mock.calls[1]?.[0].blocking).toBe(false);
	}, 15_000);

	it("caps each rule independently", async () => {
		await evalCommand(configPath, `echo ${CANARY_MARKERS.cmdSubmit}`);
		await evaluateToolCall(
			{
				sessionId: "submit-only",
				toolName: "Read",
				toolInput: { file_path: `/tmp/${CANARY_MARKERS.fileSubmit}` },
				artifacts: [{ type: "file_path", value: `/tmp/${CANARY_MARKERS.fileSubmit}` }],
			},
			{ threatsDir: THREATS_DIR, trustedDomainsDir: TRUSTED_DOMAINS_DIR, configPath },
		);
		expect(sendMock).toHaveBeenCalledTimes(2);
		expect(sendMock.mock.calls[1]?.[0].signals?.heuristics?.[0]?.rule_id).toBe(
			"DUMMY-FILE-SUBMIT-001",
		);
	}, 15_000);

	it("does not cap blocking telemetry when a submit-only rule co-occurs with a deny", async () => {
		const command = `echo ${CANARY_MARKERS.cmdSubmit} ${CANARY_MARKERS.cmdDenyAlpha}`;

		const first = await evalCommand(configPath, command);
		const second = await evalCommand(configPath, command);

		expect(first.decision).toBe("deny");
		expect(first.matchedThreatId).toBe("DUMMY-CMD-DENY-001");
		expect(second.decision).toBe("deny");
		expect(sendMock).toHaveBeenCalledTimes(2);
		expect(sendMock.mock.calls.every(([a]) => a.blocking === true)).toBe(true);
	}, 15_000);

	it("does not consume the submit cap when Community IQ is disabled", async () => {
		const disabledConfig = await writeConfig(await makeTmpDir(), { communityIq: false });

		const verdict = await evalCommand(disabledConfig, `echo ${CANARY_MARKERS.cmdSubmit}`);

		expect(verdict.decision).toBe("allow");
		expect(sendMock).not.toHaveBeenCalled();
		await expect(readFile(join(home, ".sage", "submit-limits.json"), "utf8")).rejects.toThrow();
	}, 15_000);

	it("does not send telemetry for a plain allow", async () => {
		const verdict = await evalCommand(configPath, "echo hello");
		expect(verdict.decision).toBe("allow");
		expect(sendMock).not.toHaveBeenCalled();
	}, 15_000);
});

describe("evaluateToolOutput submit-only rules", () => {
	it("does not warn on a submit-only prompt-injection rule", async () => {
		const dir = await makeTmpDir();
		const threatsDir = join(dir, "threats");
		await mkdir(threatsDir);
		await writeFile(
			join(threatsDir, "pi.yaml"),
			`- id: "TEST-PI-SUBMIT-001"
  version: 1
  detection_name: "PI:SageTestDetect-A [Tst]"
  category: prompt_injection
  severity: critical
  confidence: 0.95
  pattern: "diagmark_content_pidetect"
  match_on: content
  title: "Submit-only PI"
  flags: ["submit_only"]
`,
		);
		const configPath = await writeConfig(dir);

		const warnings = await evaluateToolOutput(
			{
				sessionId: "submit-only-post",
				toolName: "WebFetch",
				toolInput: { url: "https://example.test/page" },
				hookInput: { tool_response: { result: "text diagmark_content_pidetect text" } },
			},
			{ threatsDir, trustedDomainsDir: TRUSTED_DOMAINS_DIR, configPath },
		);

		expect(warnings).toEqual([]);
	});
});
