#!/usr/bin/env node

import { join, resolve } from "node:path";
import {
	type AgentRuntime,
	type Artifact,
	type Branding,
	BundledPiProvider,
	type CanonicalToolType,
	canonicalizeToolName,
	createOperationalLogger,
	evaluateToolCall,
	evaluateToolOutput,
	extractFromBash,
	extractFromDelete,
	extractFromEdit,
	extractFromRead,
	extractFromWebFetch,
	extractFromWrite,
	extractUrls,
	findPiWarningInAuditLog,
	formatPiWarning,
	type HookType,
	type Logger,
	loadConfigSync,
	MAX_CONTENT_SIZE,
	readProductJsonVersion,
	resolveBranding,
	type Verdict,
} from "@gendigital/sage-core";

/**
 * Resolved once at module load — child processes have no access to
 * `vscode.version` / `vscode.env.appRoot`, so the extension injects the host
 * application root into `SAGE_APP_ROOT` at hook-shim install time and we read
 * `product.json` from there. Both Cursor and VS Code ship a `product.json`
 * with a top-level `version` field, so a single read covers both hosts.
 *
 * Resolving once (rather than per call) avoids paying the disk-read cost on
 * every hook invocation; the value cannot change without a host restart, and
 * a host restart re-spawns the hook child process anyway.
 */
const HOST_AGENT_RUNTIME_VERSION = process.env.SAGE_APP_ROOT
	? readProductJsonVersion(process.env.SAGE_APP_ROOT)
	: "unknown";

// ── Platform-specific tool name maps ──────────────────────────────

const CURSOR_TOOL_MAP: Record<string, CanonicalToolType> = {
	Shell: "Bash",
};

const VSCODE_TOOL_MAP: Record<string, CanonicalToolType> = {
	run_in_terminal: "Bash",
	bash: "Bash",
	write_bash: "Bash",
	create_file: "Write",
	create: "Write",
	replace_string_in_file: "Edit",
	insert_edit_into_file: "Edit",
	edit: "Edit",
	multi_replace_string_in_file: "Edit",
	apply_patch: "ApplyPatch",
	read_file: "Read",
	view: "Read",
	grep: "Grep",
	fetch_webpage: "WebFetch",
	web_fetch: "WebFetch",
};

type CursorEventName =
	| "preToolUse"
	| "postToolUse"
	| "beforeShellExecution"
	| "beforeMCPExecution"
	| "beforeReadFile";
type HookMode = "cursor" | "vscode";

interface NormalizedHookCall {
	sessionId: string;
	conversationId: string;
	agentRuntime: AgentRuntime;
	hookType: HookType;
	toolName: CanonicalToolType;
	toolInput: Record<string, unknown>;
	artifacts: Artifact[];
	toolUseId?: string;
}

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<void> {
	const mode = argv[0] as HookMode | undefined;
	const payload = await readStdinJson();
	const config = loadConfigSync();
	const branding = resolveBranding(config.brand_key);
	const runtime = mode === "cursor" ? "cursor" : mode === "vscode" ? "vscode" : undefined;
	const logger = runtime
		? createOperationalLogger(config.operational_logging, runtime).forComponent("sage-hook")
		: undefined;

	if (mode === "cursor") {
		await handleCursor(payload, branding, logger as Logger);
		return;
	}

	if (mode === "vscode") {
		await handleVsCode(payload, branding, logger as Logger);
		return;
	}

	writeJson({});
}

async function handleCursor(payload: unknown, branding: Branding, logger: Logger): Promise<void> {
	const completeHook = async (
		result: string,
		data: Record<string, unknown> = {},
	): Promise<void> => {
		logger.debug("Cursor hook completed", {
			agentRuntime: "cursor",
			result,
			...data,
		});
		await logger.flush?.();
	};
	logger.debug("Cursor hook started", { agentRuntime: "cursor" });
	const eventName = detectCursorEvent(payload);
	if (!eventName) {
		writeJson({});
		await completeHook("skipped", { skippedReason: "unsupported_event" });
		return;
	}

	// PostToolUse: scan tool output for prompt injection
	if (eventName === "postToolUse") {
		const warning = await handlePostToolUse(payload, logger, "cursor");
		if (warning) {
			writeJson({ additional_context: warning });
		} else {
			writeJson({});
		}
		await completeHook("evaluated", { eventName, contextInjected: !!warning });
		await BundledPiProvider.exitIfModelLoaded(logger);
		return;
	}

	const normalized = normalizeCursorCall(payload, eventName);
	if (!normalized) {
		logger.warn("Could not normalize Cursor hook payload", { eventName });
		writeJson(
			internalCursorResponse(
				"allow",
				`${branding.name} could not normalize hook payload.`,
				branding,
			),
		);
		await completeHook("failed_open", { eventName, skippedReason: "invalid_payload" });
		return;
	}

	try {
		const verdict = await evaluateNormalizedCall(normalized, logger);
		writeJson(toCursorResponse(verdict, branding));
		await completeHook("evaluated", {
			eventName,
			toolName: normalized.toolName,
			sessionId: normalized.sessionId,
			toolUseId: normalized.toolUseId,
			decision: verdict.decision,
			category: verdict.category,
			severity: verdict.severity,
			artifactsCount: normalized.artifacts.length,
		});
		await BundledPiProvider.exitIfModelLoaded(logger);
	} catch (error) {
		logger.error("Cursor hook failed open", { error: String(error), eventName });
		writeJson(
			internalCursorResponse(
				"allow",
				`${branding.name} internal error; default allow policy applied.`,
				branding,
			),
		);
		await completeHook("failed_open", { eventName, decision: "allow" });
	}
}

async function handleVsCode(payload: unknown, branding: Branding, logger: Logger): Promise<void> {
	const completeHook = async (
		result: string,
		data: Record<string, unknown> = {},
	): Promise<void> => {
		logger.debug("VS Code hook completed", {
			agentRuntime: "vscode",
			result,
			...data,
		});
		await logger.flush?.();
	};
	logger.debug("VS Code hook started", { agentRuntime: "vscode" });
	const normalized = normalizeVsCodeCall(payload);
	if (!normalized) {
		writeJson({});
		await completeHook("skipped", { skippedReason: "invalid_payload" });
		return;
	}

	try {
		const verdict = await evaluateNormalizedCall(normalized, logger);
		writeJson(toVsCodeResponse(verdict, branding));
		await completeHook("evaluated", {
			toolName: normalized.toolName,
			sessionId: normalized.sessionId,
			toolUseId: normalized.toolUseId,
			decision: verdict.decision,
			category: verdict.category,
			severity: verdict.severity,
			artifactsCount: normalized.artifacts.length,
		});
		await BundledPiProvider.exitIfModelLoaded(logger);
	} catch (error) {
		logger.error("VS Code hook failed open", { error: String(error) });
		writeJson({});
		await completeHook("failed_open", { decision: "allow" });
	}
}

async function evaluateNormalizedCall(call: NormalizedHookCall, logger: Logger): Promise<Verdict> {
	const { threatsDir, trustedDomainsDir } = getBundledDataDirs();
	return evaluateToolCall(
		{
			sessionId: call.sessionId,
			conversationId: call.conversationId,
			agentRuntime: call.agentRuntime,
			agentRuntimeVersion: HOST_AGENT_RUNTIME_VERSION,
			hookType: call.hookType,
			toolName: call.toolName,
			toolInput: call.toolInput,
			artifacts: call.artifacts,
			toolUseId: call.toolUseId,
		},
		{ threatsDir, trustedDomainsDir, logger },
	);
}

function detectCursorEvent(payload: unknown): CursorEventName | undefined {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		return undefined;
	}
	const input = payload as Record<string, unknown>;
	const fromField = asString(input.hook_event_name) ?? asString(input.hookEventName);
	if (fromField && isCursorEvent(fromField)) {
		return fromField;
	}
	if (typeof input.command === "string" && input.tool_name === undefined) {
		return "beforeShellExecution";
	} else if (typeof input.file_path === "string" && input.tool_name === undefined) {
		return "beforeReadFile";
	} else if (input.tool_output !== undefined || input.tool_response !== undefined) {
		// PostToolUse: has tool_output or tool_response (result from executed tool)
		return "postToolUse";
	} else if (input.tool_name !== undefined && input.tool_input !== undefined) {
		const toolName = asString(input.tool_name) ?? "";
		if (toolName === "MCP") {
			return "beforeMCPExecution";
		}
		return "preToolUse";
	}
	return undefined;
}

function normalizeCursorCall(
	payload: unknown,
	eventName?: CursorEventName,
): NormalizedHookCall | undefined {
	if (!payload || typeof payload !== "object" || Array.isArray(payload) || !eventName) {
		return undefined;
	}

	const input = payload as Record<string, unknown>;
	const conversationId =
		asString(input.conversation_id) ??
		asString(input.conversationId) ??
		asString(input.session_id) ??
		asString(input.sessionId) ??
		"cursor";
	const sessionId =
		asString(input.session_id) ?? asString(input.sessionId) ?? conversationId ?? "cursor";
	const toolUseId = asString(input.tool_use_id);

	if (eventName === "beforeShellExecution") {
		const command = asString(input.command) ?? "";
		const toolInput: Record<string, unknown> = {
			command,
			cwd: asString(input.cwd),
		};
		return {
			sessionId,
			conversationId,
			agentRuntime: "cursor",
			hookType: "PreToolUse",
			toolName: "Bash",
			toolInput,
			artifacts: command ? extractFromBash(command) : [],
			toolUseId,
		};
	}

	if (eventName === "beforeReadFile") {
		const filePath = readFilePath(input);
		const content = asString(input.content);
		const toolInput: Record<string, unknown> = {
			file_path: filePath ?? "",
			content: content ?? "",
			attachments: Array.isArray(input.attachments) ? input.attachments : [],
		};
		return {
			sessionId,
			conversationId,
			agentRuntime: "cursor",
			hookType: "PreToolUse",
			toolName: "Read",
			toolInput,
			artifacts: extractFromRead(toolInput),
			toolUseId,
		};
	}

	if (eventName === "beforeMCPExecution") {
		const parsedToolInput = parseUnknownObject(input.tool_input);
		const toolInput: Record<string, unknown> = {
			tool_name: asString(input.tool_name),
			tool_input: parsedToolInput,
			command: asString(input.command),
			url: asString(input.url),
			server: asString(input.server),
		};
		return {
			sessionId,
			conversationId,
			agentRuntime: "cursor",
			hookType: "PreToolUse",
			toolName: "MCP",
			toolInput,
			artifacts: extractFromMcp(toolInput),
			toolUseId,
		};
	}

	const toolName = asString(input.tool_name) ?? "";
	const rawToolInput = parseUnknownObject(input.tool_input);
	const toolInput = normalizeCursorToolInput(toolName, rawToolInput);
	return {
		sessionId,
		conversationId,
		agentRuntime: "cursor",
		hookType: "PreToolUse",
		toolName: canonicalizeToolName(CURSOR_TOOL_MAP, toolName),
		toolInput,
		artifacts: extractFromCursorTool(toolName, toolInput),
		toolUseId,
	};
}

function normalizeVsCodeCall(payload: unknown): NormalizedHookCall | undefined {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		return undefined;
	}

	const input = payload as Record<string, unknown>;
	const toolName = asString(input.tool_name);
	if (!toolName) {
		return undefined;
	}

	const rawToolInput = parseUnknownObject(input.tool_input);
	const toolInput = normalizeVsCodeToolInput(toolName, rawToolInput);
	const conversationId =
		asString(input.conversation_id) ??
		asString(input.conversationId) ??
		asString(input.session_id) ??
		asString(input.sessionId) ??
		"vscode";
	const sessionId =
		asString(input.session_id) ?? asString(input.sessionId) ?? conversationId ?? "vscode";
	const toolUseId = asString(input.tool_use_id);

	return {
		sessionId,
		conversationId,
		agentRuntime: "vscode",
		hookType: "PreToolUse",
		toolName: canonicalizeToolName(VSCODE_TOOL_MAP, toolName),
		toolInput,
		artifacts: extractFromVsCodeTool(toolName, toolInput),
		toolUseId,
	};
}

/**
 * Map tool names to artifact extractors for VS Code Copilot Chat and Copilot CLI.
 *
 * Both products route through the `vscode` hook mode and send PreToolUse hooks
 * with snake_case fields (tool_name, tool_input) when hooks.json uses the
 * PascalCase event name "PreToolUse". They use different tool names.
 *
 * VS Code Copilot Chat tool names:
 *   ToolName enum in microsoft/vscode-copilot-chat
 *   https://github.com/microsoft/vscode-copilot-chat/blob/main/src/extension/tools/common/toolNames.ts
 *   Input schemas: https://github.com/microsoft/vscode-copilot-chat/tree/main/src/extension/tools/node
 *
 * Copilot CLI tool names:
 *   https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference
 *   Payload format: https://docs.github.com/en/copilot/reference/hooks-configuration
 */
function extractFromVsCodeTool(toolName: string, toolInput: Record<string, unknown>): Artifact[] {
	switch (toolName) {
		// --- Terminal / shell ---
		case "run_in_terminal": // VS Code: CoreRunInTerminal — {command, explanation, goal}
		case "bash": // Copilot CLI — {command, description}
		case "write_bash": // Copilot CLI — {shellId, input, delay}
			return extractFromBash(asString(toolInput.command) ?? "");

		// --- File create ---
		case "create_file": // VS Code: CreateFile — {filePath, content}
		case "create": // Copilot CLI — {path, content}
			return extractFromWrite(toolInput);

		// --- File edit ---
		case "replace_string_in_file": // VS Code: ReplaceString — {filePath, oldString, newString}
		case "insert_edit_into_file": // VS Code: EditFile — {filePath, code}
		case "edit": // Copilot CLI — {path, old_string, new_string}
			return extractFromEdit(toolInput);
		case "multi_replace_string_in_file": // VS Code: MultiReplaceString — {replacements: [{filePath, oldString, newString}]}
			return extractFromMultiReplace(toolInput);

		// --- File read ---
		case "read_file": // VS Code: ReadFile — {filePath}
		case "view": // Copilot CLI — {path}
		case "grep": // Copilot CLI — {pattern, path}
			return extractFromRead(toolInput);

		// --- URL fetch ---
		case "fetch_webpage": // VS Code: FetchWebPage — {urls: [], query}
			return extractFromFetchWebpage(toolInput);
		case "web_fetch": // Copilot CLI — {url}
			return extractFromWebFetch(toolInput);

		// --- Patch ---
		case "apply_patch": // VS Code: ApplyPatch — {input}; Copilot CLI — {patch}
			return extractFromApplyPatch(toolInput);

		default:
			return [];
	}
}

/** VS Code fetch_webpage sends `urls` (array) instead of single `url`. */
function extractFromFetchWebpage(toolInput: Record<string, unknown>): Artifact[] {
	if (typeof toolInput.url === "string") {
		return extractFromWebFetch(toolInput);
	}
	const urls = toolInput.urls;
	if (Array.isArray(urls)) {
		return urls
			.filter((u): u is string => typeof u === "string")
			.map((u) => ({ type: "url" as const, value: u, context: "webfetch" as const }));
	}
	return [];
}

/** VS Code multi_replace_string_in_file sends {replacements: [{filePath, oldString, newString}]}. */
function extractFromMultiReplace(toolInput: Record<string, unknown>): Artifact[] {
	const replacements = toolInput.replacements;
	if (!Array.isArray(replacements)) return [];

	const artifacts: Artifact[] = [];
	for (const entry of replacements) {
		if (!entry || typeof entry !== "object") continue;
		const r = entry as Record<string, unknown>;
		const normalized = normalizeEditLikeInput(r);
		artifacts.push(...extractFromEdit(normalized));
	}
	return artifacts;
}

/** Extract file paths from patch text (VS Code: {input}; Copilot CLI: {patch}). */
function extractFromApplyPatch(toolInput: Record<string, unknown>): Artifact[] {
	const patchText = asString(toolInput.input) ?? asString(toolInput.patch) ?? "";
	if (!patchText) return [];

	const artifacts: Artifact[] = [];
	const headerPattern = /\*{3}\s+(?:Add|Update|Delete)\s+File:\s*(.+)/g;
	for (const match of patchText.matchAll(headerPattern)) {
		const filePath = match[1]?.trim();
		if (filePath) {
			artifacts.push({ type: "file_path", value: filePath, context: "edit" });
		}
	}
	const renamePattern = /\*{3}\s+(?:Move\s+to|Rename\s+File):\s*(.+)/gi;
	for (const match of patchText.matchAll(renamePattern)) {
		const raw = match[1]?.trim();
		if (!raw) continue;
		const arrow = raw.indexOf(" -> ");
		if (arrow !== -1) {
			const src = raw.slice(0, arrow).trim();
			const dst = raw.slice(arrow + 4).trim();
			if (src) artifacts.push({ type: "file_path", value: src, context: "edit" });
			if (dst) artifacts.push({ type: "file_path", value: dst, context: "edit" });
		} else {
			artifacts.push({ type: "file_path", value: raw, context: "edit" });
		}
	}
	// Also scan the full patch content for URLs.
	const capped = patchText.slice(0, MAX_CONTENT_SIZE);
	for (const url of extractUrls(capped)) {
		artifacts.push({ type: "url", value: url, context: "from_edit_content" });
	}
	if (capped.trim()) {
		artifacts.push({ type: "content", value: capped, context: "edit" });
	}
	return artifacts;
}

function extractFromCursorTool(toolName: string, toolInput: Record<string, unknown>): Artifact[] {
	switch (toolName) {
		case "Shell":
			return extractFromBash(asString(toolInput.command) ?? "");
		case "WebFetch":
			return extractFromWebFetch(toolInput);
		case "Write": {
			const normalized = normalizeWriteLikeInput(toolInput);
			return extractFromWrite(normalized);
		}
		case "Edit": {
			const normalized = normalizeEditLikeInput(toolInput);
			return extractFromEdit(normalized);
		}
		case "Read":
			return extractFromRead(toolInput);
		case "Delete":
			return extractFromDelete(toolInput);
		case "MCP":
			return extractFromMcp(toolInput);
		default:
			return [];
	}
}

function normalizeWriteLikeInput(toolInput: Record<string, unknown>): Record<string, unknown> {
	const filePath = readFilePath(toolInput);
	const content = asString(toolInput.content) ?? asString(toolInput.new_string) ?? "";
	return {
		...toolInput,
		file_path: filePath ?? "",
		content,
	};
}

function normalizeEditLikeInput(toolInput: Record<string, unknown>): Record<string, unknown> {
	const filePath = readFilePath(toolInput);
	const newString =
		asString(toolInput.new_string) ??
		asString(toolInput.newString) ??
		asString(toolInput.code) ?? // VS Code insert_edit_into_file
		asString(toolInput.streamContent) ??
		asString(toolInput.stream_content) ??
		asString(toolInput.content) ??
		"";
	return {
		...toolInput,
		file_path: filePath ?? "",
		new_string: newString,
	};
}

function normalizeCursorToolInput(
	toolName: string,
	toolInput: Record<string, unknown>,
): Record<string, unknown> {
	if (toolName === "Read" || toolName === "Delete") {
		return { ...toolInput, file_path: readFilePath(toolInput) ?? "" };
	}
	return toolInput;
}

function normalizeVsCodeToolInput(
	toolName: string,
	toolInput: Record<string, unknown>,
): Record<string, unknown> {
	switch (toolName) {
		case "run_in_terminal":
		case "bash":
		case "write_bash":
			return {
				...toolInput,
				command: asString(toolInput.command) ?? asString(toolInput.input) ?? "",
			};
		case "create_file":
		case "create":
			return normalizeWriteLikeInput(toolInput);
		case "replace_string_in_file":
		case "insert_edit_into_file":
		case "edit":
			return normalizeEditLikeInput(toolInput);
		case "multi_replace_string_in_file":
			return normalizeMultiReplaceTopLevel(toolInput);
		case "read_file":
		case "view":
		case "grep":
			return { ...toolInput, file_path: readFilePath(toolInput) ?? "" };
		default:
			return toolInput;
	}
}

function normalizeMultiReplaceTopLevel(
	toolInput: Record<string, unknown>,
): Record<string, unknown> {
	const replacements = toolInput.replacements;
	if (!Array.isArray(replacements)) return toolInput;
	const parts: { filePath: string; newString: string }[] = [];
	for (const entry of replacements) {
		if (!entry || typeof entry !== "object") continue;
		const r = entry as Record<string, unknown>;
		parts.push({
			filePath: readFilePath(r) ?? "",
			newString: asString(r.new_string) ?? asString(r.newString) ?? asString(r.code) ?? "",
		});
	}
	return {
		...toolInput,
		file_path: parts[0]?.filePath ?? "",
		new_string: parts.map((p) => p.newString).join("\n"),
	};
}

function extractFromMcp(toolInput: Record<string, unknown>): Artifact[] {
	const artifacts: Artifact[] = [];

	const mcpPayload = parseUnknownObject(toolInput.tool_input ?? toolInput.toolInput);
	const mergedInput: Record<string, unknown> = {
		...mcpPayload,
		...toolInput,
	};

	const directUrl = asString(mergedInput.url);
	if (directUrl) {
		artifacts.push({ type: "url", value: directUrl, context: "mcp" });
	}

	const directCommand = asString(mergedInput.command) ?? asString(mergedInput.cmd);
	if (directCommand) {
		artifacts.push({ type: "command", value: directCommand, context: "mcp" });
	}

	const directPath = readFilePath(mergedInput);
	if (directPath) {
		artifacts.push({ type: "file_path", value: directPath, context: "mcp" });
	}

	for (const value of collectStrings(mergedInput, 0)) {
		for (const url of extractUrls(value)) {
			artifacts.push({ type: "url", value: url, context: "mcp" });
		}
	}

	return dedupeArtifacts(artifacts);
}

function collectStrings(value: unknown, depth: number): string[] {
	if (depth > 4) {
		return [];
	}
	if (typeof value === "string") {
		return [value.slice(0, MAX_CONTENT_SIZE)];
	}
	if (Array.isArray(value)) {
		return value.flatMap((entry) => collectStrings(entry, depth + 1));
	}
	if (value && typeof value === "object") {
		return Object.values(value).flatMap((entry) => collectStrings(entry, depth + 1));
	}
	return [];
}

function dedupeArtifacts(artifacts: Artifact[]): Artifact[] {
	const seen = new Set<string>();
	const output: Artifact[] = [];
	for (const artifact of artifacts) {
		const key = `${artifact.type}:${artifact.value}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		output.push(artifact);
	}
	return output;
}

function readFilePath(toolInput: Record<string, unknown>): string | undefined {
	return (
		asString(toolInput.file_path) ??
		asString(toolInput.path) ??
		asString(toolInput.filePath) ??
		asString(toolInput.target_file) ??
		asString(toolInput.filename)
	);
}

function toCursorResponse(verdict: Verdict, branding: Branding): Record<string, unknown> {
	if (verdict.decision === "allow") {
		return { decision: "allow", permission: "allow" };
	}

	const reason = truncateReason(verdict, branding);
	const agentMessage = `${branding.name} ${verdict.decision === "deny" ? "blocked" : "flagged"} this action (${verdict.severity}).`;

	return {
		decision: verdict.decision === "ask" ? "ask" : "deny",
		permission: verdict.decision === "ask" ? "ask" : "deny",
		reason,
		user_message: reason,
		agent_message: agentMessage,
	};
}

function toVsCodeResponse(verdict: Verdict, branding: Branding): Record<string, unknown> {
	if (verdict.decision === "allow") {
		return {};
	}

	return {
		hookSpecificOutput: {
			hookEventName: "PreToolUse",
			permissionDecision: verdict.decision,
			permissionDecisionReason: truncateReason(verdict, branding),
		},
	};
}

function internalCursorResponse(
	decision: "allow" | "deny",
	reason: string,
	branding: Branding,
): Record<string, unknown> {
	return {
		decision,
		permission: decision,
		reason,
		user_message: reason,
		agent_message:
			decision === "allow" ? undefined : `${branding.name} internal error policy applied.`,
	};
}

function truncateReason(verdict: Verdict, branding: Branding): string {
	if (verdict.reasons.length === 0) {
		return `${branding.name} flagged this action (${verdict.category}).`;
	}
	const joined = verdict.reasons.slice(0, 5).join("; ");
	return joined.length <= 350 ? joined : `${joined.slice(0, 347)}...`;
}

function getBundledDataDirs(): { threatsDir: string; trustedDomainsDir: string } {
	const extensionRoot = resolve(__dirname, "..");
	return {
		threatsDir: join(extensionRoot, "resources", "threats"),
		trustedDomainsDir: join(extensionRoot, "resources", "trusted-domains"),
	};
}

function isCursorEvent(value: string): value is CursorEventName {
	return (
		value === "preToolUse" ||
		value === "postToolUse" ||
		value === "beforeShellExecution" ||
		value === "beforeMCPExecution" ||
		value === "beforeReadFile"
	);
}

async function handlePostToolUse(
	payload: unknown,
	logger: Logger,
	agentRuntime: AgentRuntime,
): Promise<string | null> {
	try {
		if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
		const input = payload as Record<string, unknown>;
		const toolName = asString(input.tool_name) ?? "";

		const parts: string[] = [];
		const config = loadConfigSync(undefined, logger);
		const branding = resolveBranding(config.brand_key, logger);

		// PI warning injection from PreToolUse audit log (medium-risk WebFetch)
		const toolUseId = asString(input.tool_use_id) ?? "";
		if (
			toolName === "WebFetch" &&
			toolUseId &&
			config.logging.enabled &&
			config.sensitivity !== "relaxed"
		) {
			try {
				const piWarning = await findPiWarningInAuditLog(config.logging, toolUseId, config.pi_check);
				if (piWarning) {
					parts.push(`🛡️ ${formatPiWarning(piWarning, branding)}`);
				}
			} catch (error) {
				logger.debug("Failed to resolve PI warning from audit log", { error: String(error) });
				// Best-effort
			}
		}

		// Heuristic content scanning on tool output
		const sessionId = asString(input.session_id) ?? "unknown";
		const toolInput = parseUnknownObject(input.tool_input);
		const canonicalToolName = canonicalizeToolName(CURSOR_TOOL_MAP, toolName);
		const { threatsDir, trustedDomainsDir } = getBundledDataDirs();

		const warnings = await evaluateToolOutput(
			{
				sessionId,
				conversationId: sessionId,
				agentRuntime: agentRuntime,
				agentRuntimeVersion: HOST_AGENT_RUNTIME_VERSION,
				hookType: "PostToolUse",
				toolName: canonicalToolName,
				toolInput,
				hookInput: input,
				toolUseId,
			},
			{
				threatsDir,
				trustedDomainsDir,
				logger,
			},
		);

		for (const w of warnings) {
			parts.push(`🛡️ ${w.message}`);
		}

		if (parts.length === 0) return null;
		return parts.join("\n\n");
	} catch (error) {
		logger.error("PostToolUse hook failed open", { error: String(error) });
		return null; // Fail open
	}
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function parseUnknownObject(value: unknown): Record<string, unknown> {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	if (typeof value === "string") {
		try {
			const parsed = JSON.parse(value);
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
				return parsed as Record<string, unknown>;
			}
		} catch {
			// Ignore parse errors.
		}
	}
	return {};
}

async function readStdinJson(): Promise<unknown> {
	// Cursor hooks on Windows can deliver stdin as UTF-16LE (PowerShell pipeline encoding),
	// which breaks JSON.parse if we assume UTF-8. Read bytes and attempt both decodings.
	const raw = await new Promise<Buffer>((resolve) => {
		const chunks: Buffer[] = [];
		process.stdin.on("data", (chunk) => {
			// Node normally gives Buffer chunks when no encoding is set, but be defensive.
			chunks.push(typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk);
		});
		process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
	});

	function stripBom(value: string): string {
		return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
	}

	function tryParseJson(value: string): unknown | undefined {
		const trimmed = stripBom(value).trim();
		if (!trimmed) {
			return {};
		}
		try {
			return JSON.parse(trimmed);
		} catch {
			return undefined;
		}
	}

	const asUtf8 = raw.toString("utf8");
	const parsedUtf8 = tryParseJson(asUtf8);
	if (parsedUtf8 !== undefined) {
		return parsedUtf8;
	}

	const asUtf16le = raw.toString("utf16le");
	const parsedUtf16le = tryParseJson(asUtf16le);
	if (parsedUtf16le !== undefined) {
		return parsedUtf16le;
	}

	return {};
}

function writeJson(payload: Record<string, unknown>): void {
	process.stdout.write(`${JSON.stringify(payload)}\n`);
}

if (require.main === module) {
	runCli().catch(() => {
		// Protocol safety: emit valid JSON and never fail with non-JSON output.
		writeJson({});
	});
}
