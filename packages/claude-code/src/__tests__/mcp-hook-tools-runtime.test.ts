import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerClaudeHookTools } from "../mcp-hook-tools.js";

const mocks = vi.hoisted(() => ({
	allowVerdict: vi.fn((message: string) => ({ decision: "allow", reason: message })),
	ConfigSchema: {
		parse: vi.fn(() => ({ brand_key: undefined, sensitivity: "balanced" })),
	},
	handlePostToolUseHook: vi.fn(),
	handlePreToolUseHook: vi.fn(),
	isAmsiSupported: vi.fn(() => false),
	loadConfig: vi.fn(),
	makePreToolUseResponse: vi.fn((verdict: unknown, branding: unknown) => ({
		branding,
		hookSpecificOutput: {
			hookEventName: "PreToolUse",
			permissionDecision: "allow",
			permissionDecisionReason: (verdict as { reason?: string }).reason,
		},
	})),
	resolveBranding: vi.fn(),
	amsiInitResults: [] as boolean[],
	amsiInit: vi.fn(),
	amsiClose: vi.fn(),
	amsiClientsSeen: [] as unknown[],
}));

vi.mock("@gendigital/sage-core", () => ({
	AmsiClient: class {
		isAvailable = false;

		close() {
			mocks.amsiClose();
		}

		async init() {
			mocks.amsiInit();
			this.isAvailable = mocks.amsiInitResults.shift() ?? false;
		}
	},
	allowVerdict: mocks.allowVerdict,
	ConfigSchema: mocks.ConfigSchema,
	defaultBranding: { name: "Sage" },
	isAmsiSupported: mocks.isAmsiSupported,
	loadConfig: mocks.loadConfig,
	nullLogger: {
		debug: vi.fn(),
		error: vi.fn(),
		flush: vi.fn(),
	},
	resolveBranding: mocks.resolveBranding,
}));

vi.mock("../hook-handlers.js", () => ({
	getPluginRoot: vi.fn(() => "/plugin"),
	handlePostToolUseHook: mocks.handlePostToolUseHook,
	handlePreToolUseHook: mocks.handlePreToolUseHook,
	makePreToolUseResponse: mocks.makePreToolUseResponse,
}));

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };
type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;
type RegisterHandlerOptions = {
	agentRuntimeVersion?: string;
};
type AmsiLease = {
	client: unknown;
	release: () => void | Promise<void>;
};
type PreToolUseHookOptions = {
	logger: unknown;
	acquireAmsiClientLease?: (logger: unknown) => Promise<AmsiLease | null>;
};

function registerHandlers(options: RegisterHandlerOptions = {}) {
	const handlers = new Map<string, ToolHandler>();
	const server = {
		registerTool: vi.fn((name: string, _definition: unknown, handler: ToolHandler) => {
			handlers.set(name, handler);
		}),
	};
	const logger = {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		flush: vi.fn(),
	};

	registerClaudeHookTools(server as unknown as McpServer, {
		logger,
		runtimeCacheTtlMs: 0,
		...options,
	});

	return { handlers, logger };
}

function waitForDeferredClose(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("registerClaudeHookTools runtime loading", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.isAmsiSupported.mockReturnValue(false);
		mocks.loadConfig.mockRejectedValue(new Error("invalid config"));
		mocks.ConfigSchema.parse.mockReturnValue({ brand_key: undefined, sensitivity: "balanced" });
		mocks.resolveBranding.mockReturnValue({ name: "Sage" });
		mocks.amsiInitResults.length = 0;
		mocks.amsiClientsSeen.length = 0;
	});

	it("uses default runtime config when refresh fails", async () => {
		const cachedConfig = { brand_key: "cached" };
		const defaultConfig = { brand_key: undefined, sensitivity: "balanced" };
		mocks.ConfigSchema.parse.mockReturnValue(defaultConfig);
		mocks.loadConfig
			.mockResolvedValueOnce(cachedConfig)
			.mockRejectedValueOnce(new Error("reload failed"));
		mocks.handlePreToolUseHook.mockResolvedValue({});

		const { handlers } = registerHandlers();
		const handler = handlers.get("sage_claude_pre_tool_use");

		await handler?.({ tool_name: "Bash", tool_input: { command: "echo first" } });
		const result = await handler?.({ tool_name: "Bash", tool_input: { command: "echo second" } });

		expect(mocks.loadConfig).toHaveBeenCalledTimes(2);
		expect(mocks.handlePreToolUseHook).toHaveBeenCalledTimes(2);
		expect(mocks.ConfigSchema.parse).toHaveBeenCalledWith({});
		expect(mocks.handlePreToolUseHook).toHaveBeenLastCalledWith(
			expect.objectContaining({
				tool_name: "Bash",
				tool_input: { command: "echo second" },
			}),
			expect.objectContaining({
				config: defaultConfig,
			}),
		);
		expect(JSON.parse(result?.content[0]?.text ?? "")).toEqual({});
	});

	it("retries AMSI initialization after a transient unavailable result", async () => {
		mocks.isAmsiSupported.mockReturnValue(true);
		mocks.loadConfig.mockResolvedValue({ brand_key: undefined });
		mocks.amsiInitResults.push(false, true);
		mocks.handlePreToolUseHook.mockImplementation(
			async (_hookInput: unknown, options: PreToolUseHookOptions) => {
				const lease = await options.acquireAmsiClientLease?.(options.logger);
				mocks.amsiClientsSeen.push(lease?.client ?? null);
				await lease?.release();
				return { ok: true };
			},
		);

		const { handlers } = registerHandlers();
		const handler = handlers.get("sage_claude_pre_tool_use");

		await handler?.({ tool_name: "Bash", tool_input: { command: "echo first" } });
		await handler?.({ tool_name: "Bash", tool_input: { command: "echo second" } });

		expect(mocks.amsiInit).toHaveBeenCalledTimes(2);
		expect(mocks.amsiClose).toHaveBeenCalledTimes(1);
		expect(mocks.amsiClientsSeen[0]).toBeNull();
		expect(mocks.amsiClientsSeen[1]).toEqual(expect.objectContaining({ isAvailable: true }));

		// When the shared client's backend later dies, the stale client is
		// closed and replaced on the next request.
		(mocks.amsiClientsSeen[1] as { isAvailable: boolean }).isAvailable = false;
		mocks.amsiInitResults.push(true);

		await handler?.({ tool_name: "Bash", tool_input: { command: "echo third" } });

		expect(mocks.amsiInit).toHaveBeenCalledTimes(3);
		expect(mocks.amsiClose).toHaveBeenCalledTimes(2);
		expect(mocks.amsiClientsSeen[2]).toEqual(expect.objectContaining({ isAvailable: true }));
	});

	it("uses a temporary AMSI client instead of waiting when the shared client is busy", async () => {
		mocks.isAmsiSupported.mockReturnValue(true);
		mocks.loadConfig.mockResolvedValue({ brand_key: undefined });
		mocks.amsiInitResults.push(true, true);

		let releaseFirst!: () => void;
		const firstRelease = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		let firstAcquired!: () => void;
		const firstAcquiredPromise = new Promise<void>((resolve) => {
			firstAcquired = resolve;
		});

		mocks.handlePreToolUseHook.mockImplementation(
			async (_hookInput: unknown, options: PreToolUseHookOptions) => {
				const lease = await options.acquireAmsiClientLease?.(options.logger);
				mocks.amsiClientsSeen.push(lease?.client ?? null);
				if (mocks.amsiClientsSeen.length === 1) {
					firstAcquired();
					await firstRelease;
				}
				await lease?.release();
				return { ok: true };
			},
		);

		const { handlers } = registerHandlers();
		const handler = handlers.get("sage_claude_pre_tool_use");

		const first = handler?.({ tool_name: "Bash", tool_input: { command: "echo first" } });
		await firstAcquiredPromise;
		await handler?.({ tool_name: "Bash", tool_input: { command: "echo second" } });

		expect(mocks.amsiInit.mock.calls.length).toBeGreaterThanOrEqual(1);
		expect(mocks.amsiClientsSeen[0]).toEqual(expect.objectContaining({ isAvailable: true }));
		expect(mocks.amsiClientsSeen[1]).toEqual(expect.objectContaining({ isAvailable: true }));
		expect(mocks.amsiClientsSeen[1]).not.toBe(mocks.amsiClientsSeen[0]);
		expect(mocks.amsiClose).toHaveBeenCalledTimes(0);

		await waitForDeferredClose();
		expect(mocks.amsiClose).toHaveBeenCalledTimes(1);

		releaseFirst();
		await first;
		expect(mocks.amsiClose).toHaveBeenCalledTimes(1);
	});

	it("passes the resolved Claude runtime version to hook handlers", async () => {
		mocks.loadConfig.mockResolvedValue({ brand_key: undefined });
		mocks.handlePreToolUseHook.mockResolvedValue({});
		mocks.handlePostToolUseHook.mockResolvedValue({});

		const { handlers } = registerHandlers({ agentRuntimeVersion: "2.1.150" });
		const preHandler = handlers.get("sage_claude_pre_tool_use");
		const postHandler = handlers.get("sage_claude_post_tool_use");

		await preHandler?.({ tool_name: "Bash", tool_input: { command: "echo hi" } });
		await postHandler?.({
			tool_name: "Read",
			tool_use_id: "toolu_1",
			tool_response: { content: "ok" },
		});

		expect(mocks.handlePreToolUseHook).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				agentRuntimeVersion: "2.1.150",
			}),
		);
		expect(mocks.handlePostToolUseHook).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				agentRuntimeVersion: "2.1.150",
			}),
		);
	});

	it("warns when tool_input cannot be decoded", async () => {
		mocks.loadConfig.mockResolvedValue({ brand_key: undefined });
		mocks.handlePreToolUseHook.mockResolvedValue({});

		const { handlers, logger } = registerHandlers();
		const handler = handlers.get("sage_claude_pre_tool_use");

		await handler?.({ tool_name: "Bash", tool_input: "{not valid json" });

		expect(logger.warn).toHaveBeenCalledWith(
			"MCP hook tool_input could not be decoded; artifact extraction will be skipped",
			expect.objectContaining({
				hookType: "PreToolUse",
				toolName: "Bash",
				toolInputType: "string",
			}),
		);
		expect(mocks.handlePreToolUseHook).toHaveBeenCalledWith(
			expect.not.objectContaining({ tool_input: expect.anything() }),
			expect.anything(),
		);
	});

	it("does not warn when tool_input decodes successfully", async () => {
		mocks.loadConfig.mockResolvedValue({ brand_key: undefined });
		mocks.handlePreToolUseHook.mockResolvedValue({});

		const { handlers, logger } = registerHandlers();
		const handler = handlers.get("sage_claude_pre_tool_use");

		await handler?.({ tool_name: "Bash", tool_input: JSON.stringify({ command: "echo hi" }) });

		expect(logger.warn).not.toHaveBeenCalled();
	});
});
