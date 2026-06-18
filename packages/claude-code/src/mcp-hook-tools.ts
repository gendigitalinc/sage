import {
	AmsiClient,
	type AmsiClientLease,
	allowVerdict,
	type Branding,
	type Config,
	ConfigSchema,
	defaultBranding,
	isAmsiSupported,
	type Logger,
	loadConfig,
	nullLogger,
	resolveBranding,
} from "@gendigital/sage-core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListToolsRequestSchema, type ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
	getPluginRoot,
	handlePostToolUseHook,
	handlePreToolUseHook,
	makePreToolUseResponse,
} from "./hook-handlers.js";
import { resolveClaudeCodeVersion } from "./runtime-version.js";

const HookInputSchema = z
	.object({
		session_id: z.string().optional(),
		transcript_path: z.string().optional(),
		cwd: z.string().optional(),
		permission_mode: z.string().optional(),
		hook_event_name: z.string().optional(),
		tool_name: z.string().optional(),
		tool_use_id: z.string().optional(),
		tool_input: z.unknown().optional(),
		tool_response: z.unknown().optional(),
		duration_ms: z.union([z.number(), z.string()]).optional(),
		agent_id: z.string().optional(),
		agent_type: z.string().optional(),
		worktree: z.string().optional(),
	})
	.passthrough();

type HookToolArgs = z.infer<typeof HookInputSchema>;

interface Runtime {
	config: Config;
	branding: Branding;
}

interface RegisterClaudeHookToolsOptions {
	logger?: Logger;
	pluginRoot?: string;
	runtime?: Runtime;
	runtimeCacheTtlMs?: number;
	agentRuntimeVersion?: string;
}

const DEFAULT_RUNTIME_CACHE_TTL_MS = 10_000;

/**
 * Hook tools are invoked by Claude Code `mcp_tool` hooks, which dispatch
 * `tools/call` by name. Hiding them from `tools/list` keeps them out of the
 * model's tool inventory so the agent cannot invoke them directly.
 */
export const HIDDEN_HOOK_TOOL_NAMES: ReadonlySet<string> = new Set([
	"sage_claude_pre_tool_use",
	"sage_claude_post_tool_use",
]);

let sharedAmsiClient: AmsiClient | null = null;
let sharedAmsiInit: Promise<AmsiClient | null> | null = null;
let sharedAmsiBusy = false;
let sharedAmsiUnavailable = false;
let sharedAmsiCleanupRegistered = false;

function registerSharedAmsiCleanup(): void {
	if (sharedAmsiCleanupRegistered) return;
	sharedAmsiCleanupRegistered = true;
	process.once("exit", () => {
		sharedAmsiClient?.close();
		sharedAmsiClient = null;
	});
}

function releaseSharedAmsiClient(): void {
	sharedAmsiBusy = false;
	if (sharedAmsiClient && !sharedAmsiClient.isAvailable) {
		sharedAmsiClient.close();
		sharedAmsiClient = null;
	}
}

function makeSharedAmsiLease(client: AmsiClient): AmsiClientLease {
	sharedAmsiBusy = true;
	return {
		client,
		release: releaseSharedAmsiClient,
	};
}

function closeTemporaryAmsiClientAfterHook(client: AmsiClient): void {
	const handle = setTimeout(() => {
		try {
			client.close();
		} catch {
			// Best effort: temporary AMSI teardown should never fail a hook after it returned.
		}
	}, 0);
	handle.unref?.();
}

async function createTemporaryAmsiLease(logger: Logger): Promise<AmsiClientLease | null> {
	const client = new AmsiClient(logger);
	await client.init();
	if (!client.isAvailable) {
		client.close();
		return null;
	}

	return {
		client,
		release: () => {
			closeTemporaryAmsiClientAfterHook(client);
		},
	};
}

async function initializeSharedAmsiClient(logger: Logger): Promise<AmsiClient | null> {
	sharedAmsiInit ??= (async () => {
		// Release a previous client whose backend died (e.g. the PowerShell
		// process exited or was torn down after a scan timeout).
		sharedAmsiClient?.close();
		sharedAmsiClient = null;
		const client = new AmsiClient(logger);
		await client.init();
		if (client.isAvailable) {
			sharedAmsiClient = client;
			registerSharedAmsiCleanup();
			return client;
		}

		client.close();
		return null;
	})().finally(() => {
		sharedAmsiInit = null;
	});

	return sharedAmsiInit;
}

async function acquireAmsiClientLease(logger: Logger): Promise<AmsiClientLease | null> {
	if (sharedAmsiUnavailable) return null;
	if (!isAmsiSupported()) {
		sharedAmsiUnavailable = true;
		return null;
	}

	if (sharedAmsiClient?.isAvailable && !sharedAmsiBusy) {
		return makeSharedAmsiLease(sharedAmsiClient);
	}

	if (sharedAmsiClient?.isAvailable || sharedAmsiInit) {
		return createTemporaryAmsiLease(logger);
	}

	const client = await initializeSharedAmsiClient(logger);
	if (!client?.isAvailable) return null;
	return makeSharedAmsiLease(client);
}

const TOP_LEVEL_KEYS = [
	"session_id",
	"transcript_path",
	"cwd",
	"permission_mode",
	"hook_event_name",
	"tool_name",
	"tool_use_id",
	"duration_ms",
	"agent_id",
	"agent_type",
	"worktree",
] as const;

const KNOWN_RAW_ARG_KEYS = new Set<string>(["tool_input", "tool_response", ...TOP_LEVEL_KEYS]);

function textResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sortedRecordKeys(value: unknown): string[] {
	return isRecord(value) ? Object.keys(value).sort() : [];
}

function logNormalizationDiagnostics(
	logger: Logger,
	hookType: "PreToolUse" | "PostToolUse",
	rawArgs: HookToolArgs,
	normalized: Record<string, unknown>,
): void {
	const unexpectedFields = Object.keys(rawArgs)
		.filter((key) => !KNOWN_RAW_ARG_KEYS.has(key))
		.sort();
	if (unexpectedFields.length > 0) {
		logger.debug("MCP hook input contained unexpected fields", {
			hookType,
			transport: "mcp_tool",
			unexpectedFields,
		});
	}

	// A dropped tool_input means artifact extraction is skipped entirely (fail-open
	// allow), so surface it at warn level rather than debug.
	if (rawArgs.tool_input !== undefined && normalized.tool_input === undefined) {
		logger.warn("MCP hook tool_input could not be decoded; artifact extraction will be skipped", {
			hookType,
			transport: "mcp_tool",
			toolName: typeof rawArgs.tool_name === "string" ? rawArgs.tool_name : undefined,
			toolInputType: typeof rawArgs.tool_input,
		});
	}

	const normalizedKeys = Object.keys(normalized).sort();
	const missingCoreFields = ["tool_name"].filter((field) => normalized[field] === undefined);
	const hasToolPayload =
		isRecord(normalized.tool_input) ||
		isRecord(normalized.tool_response) ||
		typeof normalized.tool_output === "string";
	if (normalizedKeys.length === 0 || missingCoreFields.length > 0 || !hasToolPayload) {
		logger.debug("MCP hook input normalized with minimal fields", {
			hookType,
			transport: "mcp_tool",
			normalizedKeys,
			toolInputKeys: sortedRecordKeys(normalized.tool_input),
			toolResponseKeys: sortedRecordKeys(normalized.tool_response),
			missingCoreFields,
		});
	}
}

function decodeStructuralRecord(value: unknown): Record<string, unknown> | undefined {
	if (isRecord(value)) return value;
	if (typeof value !== "string") return undefined;

	// `tool_input` / `tool_response` are always JSON objects when structural;
	// Claude never sends a top-level array, so only decode `{...}`.
	const trimmed = value.trim();
	if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
		try {
			const parsed: unknown = JSON.parse(trimmed);
			return isRecord(parsed) ? parsed : undefined;
		} catch {
			// Not JSON; keep the original string.
		}
	}

	return undefined;
}

function coerceNumberFields(input: Record<string, unknown>, fields: readonly string[]): void {
	for (const field of fields) {
		const value = input[field];
		if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value)) {
			input[field] = Number(value);
		}
	}
}

export function normalizeClaudeHookInput(args: HookToolArgs): Record<string, unknown> {
	// Claude MCP hook templates pass whole `${tool_input}` / `${tool_response}`
	// objects as JSON strings. Decode those structural fields while preserving
	// leaf strings for threat scanning.
	const normalized: Record<string, unknown> = {};
	for (const key of TOP_LEVEL_KEYS) {
		if (args[key] !== undefined) normalized[key] = args[key];
	}
	coerceNumberFields(normalized, ["duration_ms"]);

	const decodedToolInput = decodeStructuralRecord(args.tool_input);
	if (decodedToolInput) {
		coerceNumberFields(decodedToolInput, ["offset", "limit"]);
		normalized.tool_input = decodedToolInput;
	}

	const decodedToolResponse = decodeStructuralRecord(args.tool_response);
	if (decodedToolResponse) {
		normalized.tool_response = decodedToolResponse;
	} else if (typeof args.tool_response === "string" && args.tool_response.length > 0) {
		normalized.tool_output = args.tool_response;
		delete normalized.tool_response;
	}

	return normalized;
}

async function loadRuntime(logger: Logger): Promise<Runtime> {
	const config = await loadConfig(undefined, logger);
	return { config, branding: resolveBranding(config.brand_key, logger) };
}

function createRuntimeLoader(
	logger: Logger,
	initialRuntime: Runtime | undefined,
	cacheTtlMs: number,
): () => Promise<Runtime> {
	let cached:
		| {
				runtime: Runtime;
				expiresAtMs: number;
		  }
		| undefined = initialRuntime
		? { runtime: initialRuntime, expiresAtMs: Date.now() + Math.max(0, cacheTtlMs) }
		: undefined;

	return async () => {
		const now = Date.now();
		if (cached && cached.expiresAtMs > now) return cached.runtime;

		try {
			const runtime = await loadRuntime(logger);
			cached = { runtime, expiresAtMs: now + Math.max(0, cacheTtlMs) };
			return runtime;
		} catch (error) {
			logger.debug("MCP hook runtime refresh failed; using default runtime", {
				error: String(error),
			});
			const config = ConfigSchema.parse({});
			const runtime = { config, branding: resolveBranding(config.brand_key, logger) };
			cached = { runtime, expiresAtMs: now + Math.max(0, cacheTtlMs) };
			return runtime;
		}
	};
}

export function registerClaudeHookTools(
	server: McpServer,
	options: RegisterClaudeHookToolsOptions = {},
): void {
	const logger = options.logger ?? nullLogger;
	const pluginRoot = options.pluginRoot ?? getPluginRoot();
	const agentRuntimeVersion = options.agentRuntimeVersion ?? resolveClaudeCodeVersion();
	const loadCachedRuntime = createRuntimeLoader(
		logger,
		options.runtime,
		options.runtimeCacheTtlMs ?? DEFAULT_RUNTIME_CACHE_TTL_MS,
	);

	server.registerTool(
		"sage_claude_pre_tool_use",
		{
			title: "Sage: Internal",
			description: "Internal. Invoked automatically by hooks; do not invoke directly.",
			inputSchema: HookInputSchema,
		},
		async (args) => {
			let branding: Branding = defaultBranding;
			try {
				const hookInput = normalizeClaudeHookInput(args);
				logNormalizationDiagnostics(logger, "PreToolUse", args, hookInput);
				const runtime = await loadCachedRuntime();
				branding = runtime.branding;
				const { config } = runtime;
				logger.debug("PreToolUse hook started", {
					hookType: "PreToolUse",
					transport: "mcp_tool",
				});
				const completeHook = async (
					result: string,
					data: Record<string, unknown> = {},
				): Promise<void> => {
					logger.debug("PreToolUse hook completed", {
						hookType: "PreToolUse",
						transport: "mcp_tool",
						result,
						...data,
					});
					await logger.flush?.();
				};
				const response = await handlePreToolUseHook(hookInput, {
					config,
					branding,
					logger,
					pluginRoot,
					agentRuntimeVersion,
					completeHook,
					acquireAmsiClientLease,
				});
				return textResult(JSON.stringify(response));
			} catch (error) {
				logger.error("PreToolUse MCP hook failed open", { error: String(error) });
				await logger.flush?.();
				return textResult(
					JSON.stringify(
						makePreToolUseResponse(allowVerdict(`Internal MCP hook error: ${error}`), branding),
					),
				);
			}
		},
	);

	server.registerTool(
		"sage_claude_post_tool_use",
		{
			title: "Sage: Internal",
			description: "Internal. Invoked automatically by hooks; do not invoke directly.",
			inputSchema: HookInputSchema,
		},
		async (args) => {
			try {
				const hookInput = normalizeClaudeHookInput(args);
				logNormalizationDiagnostics(logger, "PostToolUse", args, hookInput);
				const { config, branding } = await loadCachedRuntime();
				logger.debug("PostToolUse hook started", {
					hookType: "PostToolUse",
					transport: "mcp_tool",
				});
				const completeHook = async (
					result: string,
					data: Record<string, unknown> = {},
				): Promise<void> => {
					logger.debug("PostToolUse hook completed", {
						hookType: "PostToolUse",
						transport: "mcp_tool",
						result,
						...data,
					});
					await logger.flush?.();
				};
				const response = await handlePostToolUseHook(hookInput, {
					config,
					branding,
					logger,
					pluginRoot,
					agentRuntimeVersion,
					completeHook,
				});
				return textResult(JSON.stringify(response));
			} catch (error) {
				logger.error("PostToolUse MCP hook failed open", { error: String(error) });
				await logger.flush?.();
				return textResult(JSON.stringify({}));
			}
		},
	);
}

/**
 * Filter the given tool names out of `tools/list` responses while keeping
 * their `tools/call` handlers registered.
 *
 * Claude Code only exposes listed tools to the model, but `mcp_tool` hooks
 * dispatch `tools/call` directly by name, so hidden tools remain callable by
 * hooks. Must run after the tools are registered (registration lazily installs
 * the SDK's `tools/list` handler that this wraps). Fails open: if the SDK
 * internals are not in the expected shape, tools stay visible.
 */
export function hideToolsFromListing(
	server: McpServer,
	hiddenToolNames: ReadonlySet<string> = HIDDEN_HOOK_TOOL_NAMES,
	logger: Logger = nullLogger,
): void {
	// The SDK offers no public way to wrap an installed request handler, so
	// reach into the Protocol class's private handler map.
	const handlers = (
		server.server as unknown as {
			_requestHandlers?: Map<string, (request: unknown, extra: unknown) => Promise<unknown>>;
		}
	)._requestHandlers;
	const innerListHandler = handlers?.get?.("tools/list");
	if (typeof innerListHandler !== "function") {
		logger.warn("Could not hide hook tools from tools/list; SDK internals changed", {
			hiddenToolNames: [...hiddenToolNames],
		});
		return;
	}

	server.server.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
		const result = (await innerListHandler(request, extra)) as ListToolsResult;
		return {
			...result,
			tools: result.tools.filter((tool) => !hiddenToolNames.has(tool.name)),
		};
	});
}
