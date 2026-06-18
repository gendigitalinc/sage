import { homedir } from "node:os";
import { beforeEach, describe, expect, it, vi } from "vitest";

type MockConfig = {
	logging: {
		enabled: boolean;
		log_clean: boolean;
		path: string;
		max_bytes: number;
		max_files: number;
	};
};

type SageProxyEnvelopeArgs = {
	iid: string;
	versionApp: string;
	agentRuntime: string;
	agentRuntimeVersion: string;
};

type DryRunPayload = {
	identity: { uuid: string } & Record<string, unknown>;
	product: { version_app: string } & Record<string, unknown>;
	platform: { os: string; architecture: string };
	agent: { agent_runtime: string; agent_runtime_version: string };
	block_event: {
		tool_type: string;
		hook_type: string;
		user_action: string;
		content: Record<string, unknown>;
		signals?: {
			heuristics?: { rule_id: string }[];
			url_checks?: { url: string }[];
			amsi_checks?: {
				detection_name: string;
				content_name: string;
				content_snippet?: string;
				amsi_result: number;
			}[];
		};
	};
	event_id: string;
} & Record<string, unknown>;

type DryRunResponse = { endpoint: string; reports: Array<{ payload: DryRunPayload }> };

const mockLoadConfig = vi.fn(
	async (): Promise<MockConfig> => ({
		logging: {
			enabled: true,
			log_clean: false,
			path: "~/.sage/audit.jsonl",
			max_bytes: 0,
			max_files: 0,
		},
	}),
);

const mockGetRecentEntries = vi.fn(async (): Promise<unknown[]> => []);
const mockGetInstallationId = vi.fn(
	async (): Promise<string> => "550e8400-e29b-41d4-a716-446655440000",
);

const mockReadProductJsonVersion = vi.fn((appRoot: string): string => {
	if (!appRoot) return "unknown";
	if (appRoot === "/test/cursor/resources/app") return "3.1.14";
	if (appRoot === "/test/vscode/resources/app") return "1.117.0-insider";
	return "unknown";
});

const mockLoadExtendedInfo = vi.fn(
	async (): Promise<Record<string, Record<string, string | number | boolean>> | null> => null,
);

// Minimal mirror of `mergeExtendedInfo` from @gendigital/sage-core. The real
// merge is exercised in the core integration test; here we only need a
// faithful enough implementation to assert that the FP tool wires the call.
function mergeExtendedInfoMock(
	envelope: Record<string, unknown>,
	extendedInfo: Record<string, Record<string, string | number | boolean>> | null,
): Record<string, unknown> {
	const out: Record<string, unknown> = { ...envelope };
	if (!extendedInfo) return out;
	for (const [groupKey, groupValue] of Object.entries(extendedInfo)) {
		const existing = out[groupKey];
		if (existing === undefined || existing === null) {
			out[groupKey] = { ...groupValue };
			continue;
		}
		if (typeof existing !== "object" || Array.isArray(existing)) continue;
		const merged: Record<string, unknown> = { ...(existing as Record<string, unknown>) };
		for (const [leafKey, leafValue] of Object.entries(groupValue)) {
			const current = merged[leafKey];
			if (current === undefined || current === null) merged[leafKey] = leafValue;
		}
		out[groupKey] = merged;
	}
	return out;
}

vi.mock("@gendigital/sage-core", () => ({
	loadConfig: mockLoadConfig,
	getRecentEntries: mockGetRecentEntries,
	getInstallationId: mockGetInstallationId,
	readProductJsonVersion: mockReadProductJsonVersion,
	loadExtendedInfo: mockLoadExtendedInfo,
	mergeExtendedInfo: mergeExtendedInfoMock,
	defaultBranding: { name: "Sage", short_name: "Sage", brand_key: undefined },
	buildSageProxyEnvelope: (args: SageProxyEnvelopeArgs) => ({
		identity: { uuid: args.iid },
		product: { version_app: args.versionApp },
		platform: { os: "MACOS", architecture: "X64" },
		agent: {
			agent_runtime: args.agentRuntime,
			agent_runtime_version: args.agentRuntimeVersion,
		},
	}),
	resolveEndpoint: (path: string) =>
		`https://sage-proxy.svc.avast.com${path.startsWith("/") ? path : `/${path}`}`,
	resolvePath: (p: string) => p,
}));

function makeLogger() {
	return {
		debug() {},
		info() {},
		warn() {},
		error() {},
	};
}

describe("sage_report_false_positive", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		mockGetRecentEntries.mockReset();
		mockGetInstallationId.mockReset();
		mockReadProductJsonVersion.mockClear();
		mockLoadExtendedInfo.mockReset();
		mockLoadExtendedInfo.mockResolvedValue(null);
		// Reset env so each test controls SAGE_APP_ROOT / SAGE_AGENT_RUNTIME_VERSION
		// explicitly. The module evaluates SAGE_APP_ROOT at import time, so tests
		// that exercise the module-level resolver call vi.resetModules() and set
		// the env *before* the dynamic import.
		process.env = { ...originalEnv };
		delete process.env.SAGE_APP_ROOT;
		delete process.env.SAGE_AGENT_RUNTIME_VERSION;
		vi.resetModules();
	});

	it("builds spec-shaped payload and targets /v2/fp-report (dry_run)", async () => {
		mockGetRecentEntries.mockResolvedValueOnce([
			{
				type: "runtime_verdict",
				entry_id: "11111111-1111-1111-1111-111111111111",
				timestamp: "2026-03-10T14:32:01Z",
				session_id: "s1",
				conversation_id: "c1",
				agent_runtime: "cursor",
				tool_name: "Bash",
				tool_input_summary: "~/project/dist/bundle.js",
				artifacts: ["https://example.com/api/endpoint"],
				verdict: "deny",
				severity: "critical",
				reasons: ["Test reason"],
				source: "heuristic",
				user_override: false,
				signals: {
					heuristics: [
						{ rule_id: "CLT-CMD-006", rule_version: 3, title: "T", artifact: "rm -rf /" },
					],
					url_checks: [
						{
							detection_name: "URL:Mal",
							url: "https://example.com/api/endpoint",
						},
					],
					package_checks: [
						{
							detection_name: "SuspiciousPackage: left-pad",
							package_name: "left-pad",
							package_version: "1.0.0",
							package_registry: "npm",
						},
					],
				},
				content: {
					command: "cat ~/project/dist/bundle.js",
				},
			},
		]);

		const mod = await import("../tools/false-positive.js");
		const server = { registerTool: vi.fn() };
		mod.registerFalsePositiveTools(
			server as unknown as { registerTool: (...args: unknown[]) => void },
			{ logger: makeLogger(), versionApp: "0.5.1" },
		);

		const calls = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
		const report = calls.find((c) => c[0] === "sage_report_false_positive");
		expect(report).toBeTruthy();

		const handler = (report as unknown[])[2] as (
			input: Record<string, unknown>,
		) => Promise<{ content?: Array<{ text?: string }> }>;
		const res = await handler({
			description: "FP",
			reasoning: "Because",
			agent_runtime_version: "0.48.7",
			dry_run: true,
		});

		const text = res.content?.[0]?.text ?? "";
		const parsed = JSON.parse(text) as DryRunResponse;
		expect(parsed.endpoint).toBe("https://sage-proxy.svc.avast.com/v2/fp-report");
		expect(parsed.reports).toHaveLength(1);

		const payload = parsed.reports[0].payload;
		expect(payload.identity.uuid).toBe("550e8400-e29b-41d4-a716-446655440000");
		expect(payload.product.version_app).toBe("0.5.1");
		expect(payload.platform.os).toBeTruthy();
		expect(payload.platform.architecture).toBeTruthy();
		expect(payload.agent.agent_runtime).toBe("cursor");
		expect(payload.agent.agent_runtime_version).toBe("0.48.7");
		expect(payload.block_event.tool_type).toBe("Bash");
		expect(payload.block_event.hook_type).toBe("PreToolUse");
		expect(payload.block_event.user_action).toBe("blocked");
		expect(payload.event_id).toBe("11111111-1111-1111-1111-111111111111");

		expect(payload.block_event.signals?.heuristics?.[0]?.rule_id).toBe("CLT-CMD-006");
		expect(payload.block_event.signals?.url_checks?.[0]?.url).toBe(
			"https://example.com/api/endpoint",
		);

		// Content snapshot is read verbatim from the audit entry — no
		// reconstruction in the FP tool. Home-path scrubbing happens upstream
		// in `buildContentSnapshot`, so the payload simply mirrors what was
		// written to the audit log.
		expect(payload.block_event.content).toEqual({
			command: "cat ~/project/dist/bundle.js",
		});
	});

	it("submits multipart/form-data with type=fp and metadata JSON (non-dry_run)", async () => {
		const home = homedir().replace(/\\/g, "/");
		mockGetRecentEntries.mockResolvedValueOnce([
			{
				type: "runtime_verdict",
				entry_id: "22222222-2222-2222-2222-222222222222",
				timestamp: "2026-03-10T15:00:00Z",
				session_id: "s2",
				conversation_id: "c2",
				agent_runtime: "claude",
				tool_name: "Bash",
				tool_input_summary: `${home}/project/run.sh`,
				artifacts: [],
				verdict: "deny",
				severity: "warning",
				reasons: ["Test"],
				source: "heuristic",
				user_override: false,
				signals: {
					heuristics: [{ rule_id: "CLT-CMD-001", rule_version: 1, title: "T", artifact: "rm" }],
				},
			},
		]);
		mockGetInstallationId.mockResolvedValueOnce("550e8400-e29b-41d4-a716-446655440000");

		const fetchSpy = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			text: async () => '{"report_id":"r1"}',
		});
		vi.stubGlobal("fetch", fetchSpy);

		const mod = await import("../tools/false-positive.js");
		const server = { registerTool: vi.fn() };
		mod.registerFalsePositiveTools(
			server as unknown as { registerTool: (...args: unknown[]) => void },
			{ logger: makeLogger(), versionApp: "0.7.0" },
		);

		const calls = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
		const report = calls.find((c) => c[0] === "sage_report_false_positive");
		expect(report).toBeTruthy();

		const handler = (report as unknown[])[2] as (
			input: Record<string, unknown>,
		) => Promise<{ content?: Array<{ text?: string }> }>;
		const res = await handler({
			description: "Not malicious",
			reasoning: "It is safe",
			agent_runtime_version: "1.0.0",
			dry_run: false,
		});

		// Handler should report success
		const text = res.content?.[0]?.text ?? "";
		expect(text).toContain("Reported 1 audit entr");

		// Verify fetch was called with multipart FormData
		expect(fetchSpy).toHaveBeenCalledOnce();
		const [url, opts] = fetchSpy.mock.calls[0] as [string, { method: string; body: FormData }];
		expect(url).toBe("https://sage-proxy.svc.avast.com/v2/fp-report");
		expect(opts.method).toBe("POST");

		const body = opts.body;
		expect(body).toBeInstanceOf(FormData);
		expect(body.get("type")).toBe("fp");

		const metadata = JSON.parse(body.get("metadata") as string) as Record<string, unknown>;
		expect(metadata).toHaveProperty("block_event");
		expect(metadata).toHaveProperty("event_id", "22222222-2222-2222-2222-222222222222");

		vi.unstubAllGlobals();
	});

	function makeEntry(id: string, verdict: "deny" | "ask" | "allow", timestampSeconds = 0) {
		return {
			type: "runtime_verdict",
			entry_id: id,
			timestamp: new Date(2026, 0, 1, 0, 0, timestampSeconds).toISOString(),
			session_id: "s",
			conversation_id: "conv",
			agent_runtime: "cursor",
			tool_name: "Bash",
			tool_input_summary: "echo hi",
			artifacts: [],
			verdict,
			severity: "info",
			reasons: [],
			source: "heuristic",
			user_override: false,
			signals: {},
		};
	}

	async function runHandler(input: Record<string, unknown>) {
		const mod = await import("../tools/false-positive.js");
		const server = { registerTool: vi.fn() };
		mod.registerFalsePositiveTools(
			server as unknown as { registerTool: (...args: unknown[]) => void },
			{ logger: makeLogger(), versionApp: "0.5.1" },
		);
		const calls = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
		const report = calls.find((c) => c[0] === "sage_report_false_positive");
		const handler = (report as unknown[])[2] as (
			i: Record<string, unknown>,
		) => Promise<{ content?: Array<{ text?: string }>; isError?: boolean }>;
		return handler(input);
	}

	it("excludes allow verdicts when entry_ids is not provided", async () => {
		mockGetRecentEntries.mockResolvedValueOnce([
			makeEntry("a-allow", "allow", 1),
			makeEntry("b-deny", "deny", 2),
		]);
		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			dry_run: true,
		});
		const parsed = JSON.parse(res.content?.[0]?.text ?? "") as DryRunResponse;
		expect(parsed.reports).toHaveLength(1);
		expect(parsed.reports[0].payload.event_id).toBe("b-deny");
	});

	it("caps implicit fallback to 3 most recent deny/ask entries", async () => {
		mockGetRecentEntries.mockResolvedValueOnce([
			makeEntry("d1", "deny", 1),
			makeEntry("d2", "deny", 2),
			makeEntry("a3", "allow", 3),
			makeEntry("d4", "ask", 4),
			makeEntry("d5", "deny", 5),
			makeEntry("d6", "deny", 6),
		]);
		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			dry_run: true,
		});
		const parsed = JSON.parse(res.content?.[0]?.text ?? "") as DryRunResponse;
		expect(parsed.reports).toHaveLength(3);
		const ids = parsed.reports.map((r) => r.payload.event_id);
		expect(ids).toEqual(["d4", "d5", "d6"]);
	});

	it("allows up to 10 explicit entry_ids including allow verdicts", async () => {
		const entries = [];
		const ids: string[] = [];
		for (let i = 0; i < 5; i++) {
			const id = `entry-${i}`;
			ids.push(id);
			entries.push(makeEntry(id, i % 2 === 0 ? "allow" : "deny", i));
		}
		mockGetRecentEntries.mockResolvedValueOnce(entries);
		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			entry_ids: ids,
			dry_run: true,
		});
		const parsed = JSON.parse(res.content?.[0]?.text ?? "") as DryRunResponse;
		expect(parsed.reports).toHaveLength(5);
	});

	it("forwards content from the audit entry verbatim without reconstruction", async () => {
		const entry = {
			...makeEntry("verbatim-1", "deny"),
			tool_name: "WebFetch",
			tool_input_summary: "https://example.com/anything",
			content: {
				url: "https://example.com/api/specific",
				command: "ignored-but-kept",
			},
		} as unknown;
		mockGetRecentEntries.mockResolvedValueOnce([entry]);
		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			dry_run: true,
		});
		const parsed = JSON.parse(res.content?.[0]?.text ?? "") as DryRunResponse;
		expect(parsed.reports).toHaveLength(1);
		expect(parsed.reports[0].payload.block_event.content).toEqual({
			url: "https://example.com/api/specific",
			command: "ignored-but-kept",
		});
	});

	it("forwards amsi_checks signals with their synthesized detection_name", async () => {
		// AMSI denies carry a synthesized `detection_name` (Win32 AMSI returns
		// only a numeric threat level, so `evaluator.ts:buildAmsiSignal` derives
		// "AMSI|DETECTED" / "AMSI|BLOCKED_BY_ADMIN" from `amsi_result`). The FP
		// tool must preserve that label end-to-end so the backend can triage
		// AMSI-driven blocks; previously the parser only kept heuristics,
		// url_checks, file_checks, and package_checks, silently dropping AMSI
		// evidence.
		mockGetRecentEntries.mockResolvedValueOnce([
			{
				...makeEntry("amsi-1", "deny"),
				signals: {
					amsi_checks: [
						{
							detection_name: "AMSI|DETECTED",
							content_name: "Bash:command",
							content_snippet: "Invoke-Mimikatz -DumpCreds",
							amsi_result: 0x8000,
						},
						{
							detection_name: "AMSI|BLOCKED_BY_ADMIN",
							content_name: "Write:~/script.ps1",
							amsi_result: 0x4000,
						},
					],
				},
			},
		]);
		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			entry_ids: ["amsi-1"],
			dry_run: true,
		});
		const parsed = JSON.parse(res.content?.[0]?.text ?? "") as DryRunResponse;
		expect(parsed.reports).toHaveLength(1);
		const amsi = parsed.reports[0].payload.block_event.signals?.amsi_checks;
		expect(amsi).toEqual([
			{
				detection_name: "AMSI|DETECTED",
				content_name: "Bash:command",
				content_snippet: "Invoke-Mimikatz -DumpCreds",
				amsi_result: 0x8000,
			},
			{
				detection_name: "AMSI|BLOCKED_BY_ADMIN",
				content_name: "Write:~/script.ps1",
				amsi_result: 0x4000,
			},
		]);
	});

	it("drops malformed amsi_checks entries while keeping valid ones", async () => {
		mockGetRecentEntries.mockResolvedValueOnce([
			{
				...makeEntry("amsi-2", "deny"),
				signals: {
					amsi_checks: [
						{ detection_name: "AMSI|DETECTED", content_name: "Bash:command" },
						{ content_name: "Bash:command", amsi_result: 0x8000 },
						{ detection_name: "AMSI|DETECTED", amsi_result: 0x8000 },
						{
							detection_name: "AMSI|DETECTED",
							content_name: "Bash:command",
							amsi_result: 0x8000,
						},
					],
				},
			},
		]);
		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			entry_ids: ["amsi-2"],
			dry_run: true,
		});
		const parsed = JSON.parse(res.content?.[0]?.text ?? "") as DryRunResponse;
		const amsi = parsed.reports[0].payload.block_event.signals?.amsi_checks;
		expect(amsi).toEqual([
			{
				detection_name: "AMSI|DETECTED",
				content_name: "Bash:command",
				amsi_result: 0x8000,
			},
		]);
	});

	it("emits an empty content object for legacy entries without a content field", async () => {
		// Simulates a pre-buildContentSnapshot audit entry — no `content` field.
		const entry = { ...makeEntry("legacy-1", "deny") } as unknown;
		mockGetRecentEntries.mockResolvedValueOnce([entry]);
		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			dry_run: true,
		});
		const parsed = JSON.parse(res.content?.[0]?.text ?? "") as DryRunResponse;
		expect(parsed.reports).toHaveLength(1);
		expect(parsed.reports[0].payload.block_event.content).toEqual({});
	});

	it("merges extended-info into every FP report payload", async () => {
		mockLoadExtendedInfo.mockResolvedValueOnce({
			identity: { extra1: "ext-extra1", extra2: "ext-extra2" },
			product: { extra_id: "ext-product" },
			license: { extra_psn: "ext-psn" },
		});
		mockGetRecentEntries.mockResolvedValueOnce([
			makeEntry("e1", "deny", 1),
			makeEntry("e2", "deny", 2),
		]);

		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			entry_ids: ["e1", "e2"],
			dry_run: true,
		});

		const parsed = JSON.parse(res.content?.[0]?.text ?? "") as DryRunResponse;
		expect(parsed.reports).toHaveLength(2);
		for (const r of parsed.reports) {
			expect(r.payload.identity.uuid).toBe("550e8400-e29b-41d4-a716-446655440000");
			expect(r.payload.identity.extra1).toBe("ext-extra1");
			expect(r.payload.identity.extra2).toBe("ext-extra2");
			expect(r.payload.product.extra_id).toBe("ext-product");
			expect(r.payload.license).toEqual({ extra_psn: "ext-psn" });
		}
		// Loader is invoked once per FP-tool invocation, regardless of the
		// number of audit entries reported.
		expect(mockLoadExtendedInfo).toHaveBeenCalledTimes(1);
	});

	it("emits an unenriched payload when no extended-info is available", async () => {
		mockLoadExtendedInfo.mockResolvedValueOnce(null);
		mockGetRecentEntries.mockResolvedValueOnce([makeEntry("e1", "deny", 1)]);

		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			entry_ids: ["e1"],
			dry_run: true,
		});

		const parsed = JSON.parse(res.content?.[0]?.text ?? "") as DryRunResponse;
		expect(parsed.reports).toHaveLength(1);
		const payload = parsed.reports[0].payload;
		expect(payload.identity).toEqual({ uuid: "550e8400-e29b-41d4-a716-446655440000" });
		expect(payload.license).toBeUndefined();
		expect(payload.product.extra_id).toBeUndefined();
	});

	it("never overwrites Sage-set envelope fields when extended-info collides", async () => {
		// Hostile input: extended-info tries to overwrite Sage's own
		// installation UUID and version. Sage's values must always win.
		mockLoadExtendedInfo.mockResolvedValueOnce({
			identity: { uuid: "ATTACKER-UUID", extra1: "ext-extra1" },
			product: { version_app: "999.999.999", extra_id: "ext-product" },
		});
		mockGetRecentEntries.mockResolvedValueOnce([makeEntry("e1", "deny", 1)]);

		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			entry_ids: ["e1"],
			dry_run: true,
		});

		const parsed = JSON.parse(res.content?.[0]?.text ?? "") as DryRunResponse;
		const payload = parsed.reports[0].payload;
		expect(payload.identity.uuid).toBe("550e8400-e29b-41d4-a716-446655440000");
		expect(payload.identity.extra1).toBe("ext-extra1");
		expect(payload.product.version_app).toBe("0.5.1");
		expect(payload.product.extra_id).toBe("ext-product");
	});

	it("rejects more than 10 explicit entry_ids", async () => {
		const entries = [];
		const ids: string[] = [];
		for (let i = 0; i < 11; i++) {
			const id = `entry-${i}`;
			ids.push(id);
			entries.push(makeEntry(id, "deny", i));
		}
		mockGetRecentEntries.mockResolvedValueOnce(entries);
		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			entry_ids: ids,
			dry_run: true,
		});
		expect(res.isError).toBe(true);
		expect(res.content?.[0]?.text ?? "").toContain("Too many entry_ids");
	});

	// ── Runtime-version resolution chain ─────────────────────────────
	//
	// Order: explicit `agent_runtime_version` arg → SAGE_APP_ROOT-derived
	// product.json version → SAGE_AGENT_RUNTIME_VERSION env → "unknown".
	//
	// SAGE_APP_ROOT is read at module-load time, so each test sets the env
	// before the dynamic import inside `runHandler` (the beforeEach hook
	// calls `vi.resetModules()`, so each test's import re-evaluates the
	// module-level constant).

	it("uses readProductJsonVersion(SAGE_APP_ROOT) when no explicit override is provided", async () => {
		process.env.SAGE_APP_ROOT = "/test/cursor/resources/app";
		mockGetRecentEntries.mockResolvedValueOnce([makeEntry("v-1", "deny")]);

		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			dry_run: true,
		});
		const parsed = JSON.parse(res.content?.[0]?.text ?? "") as DryRunResponse;
		expect(parsed.reports[0].payload.agent.agent_runtime_version).toBe("3.1.14");
		expect(mockReadProductJsonVersion).toHaveBeenCalledWith("/test/cursor/resources/app");
	});

	it("prefers an explicit agent_runtime_version arg over SAGE_APP_ROOT", async () => {
		process.env.SAGE_APP_ROOT = "/test/cursor/resources/app";
		mockGetRecentEntries.mockResolvedValueOnce([makeEntry("v-2", "deny")]);

		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			agent_runtime_version: "explicit-9.9.9",
			dry_run: true,
		});
		const parsed = JSON.parse(res.content?.[0]?.text ?? "") as DryRunResponse;
		expect(parsed.reports[0].payload.agent.agent_runtime_version).toBe("explicit-9.9.9");
	});

	it("falls back to SAGE_AGENT_RUNTIME_VERSION when SAGE_APP_ROOT is unset", async () => {
		process.env.SAGE_AGENT_RUNTIME_VERSION = "env-1.2.3";
		mockGetRecentEntries.mockResolvedValueOnce([makeEntry("v-3", "deny")]);

		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			dry_run: true,
		});
		const parsed = JSON.parse(res.content?.[0]?.text ?? "") as DryRunResponse;
		expect(parsed.reports[0].payload.agent.agent_runtime_version).toBe("env-1.2.3");
		expect(mockReadProductJsonVersion).not.toHaveBeenCalled();
	});

	it("falls back to 'unknown' when SAGE_APP_ROOT and SAGE_AGENT_RUNTIME_VERSION are both unset", async () => {
		mockGetRecentEntries.mockResolvedValueOnce([makeEntry("v-4", "deny")]);

		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			dry_run: true,
		});
		const parsed = JSON.parse(res.content?.[0]?.text ?? "") as DryRunResponse;
		expect(parsed.reports[0].payload.agent.agent_runtime_version).toBe("unknown");
	});

	it("falls through to SAGE_AGENT_RUNTIME_VERSION when readProductJsonVersion returns 'unknown'", async () => {
		// `readProductJsonVersion` is fail-open and returns the literal string
		// "unknown" for missing/malformed product.json. The module-level
		// resolver collapses that sentinel to `undefined` so the documented
		// cascade (SAGE_APP_ROOT → SAGE_AGENT_RUNTIME_VERSION → "unknown")
		// continues to the env-var fallback instead of pinning the report to
		// "unknown" — which would silently break runtime-version correlation
		// whenever the host's app root is stripped or moved at runtime.
		process.env.SAGE_APP_ROOT = "/nonexistent/path";
		process.env.SAGE_AGENT_RUNTIME_VERSION = "env-1.2.3";
		mockGetRecentEntries.mockResolvedValueOnce([makeEntry("v-5", "deny")]);

		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			dry_run: true,
		});
		const parsed = JSON.parse(res.content?.[0]?.text ?? "") as DryRunResponse;
		expect(parsed.reports[0].payload.agent.agent_runtime_version).toBe("env-1.2.3");
	});

	it("falls through to 'unknown' when readProductJsonVersion returns 'unknown' and no env override is set", async () => {
		// Same scenario as above but with no env-var fallback configured —
		// the cascade must terminate at the literal "unknown" default rather
		// than throw or emit `undefined`.
		process.env.SAGE_APP_ROOT = "/nonexistent/path";
		mockGetRecentEntries.mockResolvedValueOnce([makeEntry("v-6", "deny")]);

		const res = await runHandler({
			description: "FP",
			reasoning: "Because",
			dry_run: true,
		});
		const parsed = JSON.parse(res.content?.[0]?.text ?? "") as DryRunResponse;
		expect(parsed.reports[0].payload.agent.agent_runtime_version).toBe("unknown");
	});
});
