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
	identity: { uuid: string };
	product: { version_app: string };
	platform: { os: string; architecture: string };
	agent: { agent_runtime: string; agent_runtime_version: string };
	block_event: {
		tool_type: string;
		hook_type: string;
		user_action: string;
		content: { command?: string };
		signals?: {
			heuristics?: { rule_id: string }[];
			url_checks?: { url: string }[];
		};
	};
	event_id: string;
};

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

vi.mock("@gendigital/sage-core", () => ({
	loadConfig: mockLoadConfig,
	getRecentEntries: mockGetRecentEntries,
	getInstallationId: mockGetInstallationId,
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
	beforeEach(() => {
		mockGetRecentEntries.mockReset();
		mockGetInstallationId.mockReset();
	});

	it("builds spec-shaped payload and targets /v2/fp-report (dry_run)", async () => {
		const home = homedir().replace(/\\/g, "/");
		mockGetRecentEntries.mockResolvedValueOnce([
			{
				type: "runtime_verdict",
				entry_id: "11111111-1111-1111-1111-111111111111",
				timestamp: "2026-03-10T14:32:01Z",
				session_id: "s1",
				conversation_id: "c1",
				agent_runtime: "cursor",
				tool_name: "Bash",
				tool_input_summary: `${home}/project/dist/bundle.js`,
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

		// Privacy scrub: home dir prefix should become ~
		expect(String(payload.block_event.content.command)).toContain("~");
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
				severity: "high",
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
});
