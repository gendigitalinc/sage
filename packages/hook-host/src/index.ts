/**
 * @gendigital/sage-hook-host
 *
 * Shared handler for hosts that deliver tool calls as in-process hook events
 * with a `confirm(title, message)` / `setStatus(key, text)` UI — currently pi
 * and Oh My Pi (omp). It owns the tool_call → allow/deny/ask flow, the status
 * shield, and the approval store wiring for those two.
 *
 * Scope note: despite the generic name, this is NOT a universal connector
 * layer. OpenClaw and OpenCode use different hook/result shapes (native
 * `requireApproval`, structured plugin results) and call `guardToolCall`
 * directly; adopting this package would require reshaping those. Keep
 * connector-specific behavior in the connector via `HookHandlerExtensions`,
 * not here.
 */
export {
	type HookHandlerExtensions,
	type HookHandlerOptions,
	type HookHostAPI,
	type HookToolMapping,
	type HookUI,
	type HookUIDialogOptions,
	registerHookHandlers,
	type ToolCallAdapter,
	type ToolCallContext,
	type ToolCallEvent,
	type ToolCallResult,
	type ToolResultEvent,
	type ToolResultPatch,
} from "./handler.js";
export { type ConnectorResources, resolveConnectorResources } from "./resources.js";
export { type HookSessionScanInput, runHookSessionScan } from "./session-scan.js";
export {
	createOutputScanHandlers,
	type OutputScanOptions,
	outputHookInput,
	resultText,
} from "./tool-result.js";
