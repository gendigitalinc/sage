/**
 * Shared tool_call handler for hosts that deliver in-process hook events
 * (pi, Oh My Pi). Lives outside sage-core so the published core API stays
 * platform-agnostic: event shapes, confirm UI, and the status key are host
 * concerns, not detection concerns.
 *
 * Core keeps the generic bits this calls: guardToolCall (including the raw
 * action-id override) and formatAskBlockMessage. The approval sweep lives
 * here so it does not have to be exported from core's barrel.
 */

import { resolve } from "node:path";
import {
	type AgentRuntime,
	ApprovalStore,
	type Artifact,
	type Branding,
	type CanonicalToolType,
	captureEnabled,
	captureHookInput,
	defaultBranding,
	formatAskBlockMessage,
	guardToolCall,
	type HookType,
	kv,
	type Logger,
	PAD,
	remediationHint,
	ruleLabel,
	SEPARATOR_WIDTH,
	separatorLine,
	severityEmoji,
	type Verdict,
} from "@gendigital/sage-core";

/**
 * Extra line for `pi_check` denies: the fetched content was the attack, so the
 * model must be told not to reach it another way. Lives here, not in core —
 * Claude Code keeps its own copy of the string, and only this banner uses it.
 */
export const PI_CHECK_DENY_HINT =
	"Do NOT attempt to fetch this URL again or access it through alternative tools.";

/** Same cadence OpenClaw and OpenCode use. Local so core's barrel stays unchanged. */
const APPROVAL_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function startApprovalCleanup(store: { cleanup(): void }): ReturnType<typeof setInterval> {
	const timer = setInterval(() => store.cleanup(), APPROVAL_CLEANUP_INTERVAL_MS);
	timer.unref?.();
	return timer;
}

export interface HookToolMapping {
	toolName: CanonicalToolType;
	toolInput: Record<string, unknown>;
	artifacts: Artifact[];
}

export interface ToolCallAdapter {
	/**
	 * `cwd` is the host's working directory for the call (`ctx.cwd`), so an
	 * adapter can resolve relative paths the way the host's tools will.
	 */
	mapToolCall: (toolName: string, input: Record<string, unknown>, cwd?: string) => HookToolMapping;
}

/** A tool result as both pi and OMP deliver it on `tool_result`. */
export interface ToolResultEvent {
	toolName: string;
	toolCallId: string;
	input: Record<string, unknown>;
	content: Array<{ type: string; text?: string }>;
}

/** Content returned from a `tool_result` handler replaces the result the model sees. */
export interface ToolResultPatch {
	content: Array<{ type: string; text?: string }>;
}

/**
 * Optional connector hooks around the shared verdict mapping. Kept out of the
 * core handler so pi-specific behaviour (output scanning, status file,
 * approval notes) lives in the pi package, not in core.
 */
export interface HookHandlerExtensions {
	/**
	 * Called with every non-allow verdict, e.g. to update a status-line file.
	 * May return a promise; the handler awaits it before {@link renderStatus}
	 * so a fire-and-forget write cannot race the render that reads it back.
	 */
	onNonAllow?: (sessionId: string, verdict: Verdict, ctx: ToolCallContext) => void | Promise<void>;
	/** Renders the status line after a verdict, replacing the default one-line shield. */
	renderStatus?: (ctx: ToolCallContext) => void;
	/**
	 * Called after the user approves an ask, before the tool runs. `ctx` is
	 * passed so consumers can scope any per-call bookkeeping by session id —
	 * tool call ids are only unique within a session, so a session-agnostic key
	 * can collide across sessions if a host reuses ids before TTL expiry.
	 */
	onApproved?: (
		event: ToolCallEvent,
		verdict: Verdict,
		artifacts: Artifact[],
		ctx: ToolCallContext,
	) => void;
	/** Registers a `tool_result` handler. Returning content replaces the result. */
	onToolResult?: (
		event: ToolResultEvent,
		ctx: ToolCallContext,
	) => Promise<ToolResultPatch | undefined>;
}

export interface HookHandlerOptions {
	/**
	 * Stamped on every audit entry and detection-telemetry payload for tool
	 * calls this handler evaluates. Required so pi/omp entries are not written
	 * with an empty `agent_runtime`.
	 */
	agentRuntime: AgentRuntime;
	/**
	 * Agent runtime version (e.g. pi `"1.3.0"`). Forwarded to detection
	 * telemetry. Connectors that cannot resolve a version omit it; telemetry
	 * then falls back to `SAGE_AGENT_RUNTIME_VERSION` and finally `"unknown"`.
	 */
	agentRuntimeVersion?: string;
	adapter: ToolCallAdapter;
	packageRoot: string;
	/** Overrides `<packageRoot>/resources/threats` (e.g. the repo-root `threats/`). */
	threatsDir?: string;
	/** Overrides `<packageRoot>/resources/trusted-domains`. */
	trustedDomainsDir?: string;
	logger: Logger;
	branding?: Branding;
	/**
	 * Approval store for ask verdicts. Created when omitted. Tests pass one in
	 * to assert that declined, no-UI, and failed-prompt paths drop the pending
	 * entry instead of leaving it until the stale sweep.
	 */
	approvalStore?: ApprovalStore;
	/** Connector hooks; see {@link HookHandlerExtensions}. */
	extensions?: HookHandlerExtensions;
}

/**
 * Dialog options pi's `confirm` accepts as a third argument (OMP's hook
 * `confirm` does not). Optional so one call shape type-checks against both.
 */
export interface HookUIDialogOptions {
	signal?: AbortSignal;
	timeout?: number;
}

/**
 * Intersection of pi 1.3.0 `ExtensionUIContext` and OMP 18.12 `HookUIContext`.
 *
 * Both hosts take `confirm(title, message)` and `setStatus(key, text)`.
 * Passing one string puts the banner in the title and leaves the body empty,
 * and treats the status text as a key. `setFooter` is pi-only and replaces
 * the footer *component* — it is not a status-text setter — so it is not part
 * of this surface.
 */
export interface HookUI {
	confirm(title: string, message: string, opts?: HookUIDialogOptions): Promise<boolean>;
	/** Pass `undefined` as `text` to clear the status for `key`. */
	setStatus(key: string, text: string | undefined): void;
	/** Transient notification. Both hosts expose it; optional so test doubles need not. */
	notify?(message: string, type?: "info" | "warning" | "error"): void;
}

export interface HookHostAPI {
	on(
		event: string,
		// biome-ignore lint/suspicious/noExplicitAny: hosts dispatch several event shapes through one `on`
		handler: (event: any, ctx: ToolCallContext) => Promise<unknown>,
	): void;
	sessionManager?: { getSessionId(): string };
	ui?: HookUI;
}

export interface ToolCallEvent {
	toolName: string;
	toolCallId: string;
	input: Record<string, unknown>;
}

export interface ToolCallContext {
	hasUI: boolean;
	ui?: HookUI;
	sessionManager?: { getSessionId(): string };
	/** Working directory the host resolves tool paths against. */
	cwd?: string;
}

export interface ToolCallResult {
	block?: boolean;
	reason?: string;
}

/**
 * Rich shield banner matching the Claude Code format. Exported for tests only;
 * it is not part of the package's public surface (`index.ts`).
 */
export function formatShieldBanner(verdict: Verdict, branding: Branding, action: string): string {
	const isDeny = verdict.decision === "deny";
	const emoji = severityEmoji(verdict.severity);
	const reasonText = verdict.reasons.length > 0 ? verdict.reasons[0] : verdict.category;
	const header = isDeny
		? `🛡️ ${branding.name}: Threat Blocked`
		: `🛡️ ${branding.name}: Suspicious Activity Detected`;
	const lines: string[] = [header, separatorLine(SEPARATOR_WIDTH)];
	lines.push(`${emoji} ${"Threat".padEnd(PAD)}${reasonText}`);
	const rule = ruleLabel(verdict);
	if (rule) lines.push(kv("Rule", rule));
	lines.push(kv("Severity", verdict.severity.toUpperCase()));
	const [firstArtifact, ...restArtifacts] = verdict.artifacts;
	if (firstArtifact) {
		lines.push(kv("Artifact", firstArtifact));
		for (const a of restArtifacts) {
			lines.push(kv("", a));
		}
	}
	if (verdict.source && verdict.source !== "none") {
		lines.push(kv("Source", verdict.source));
	}
	lines.push(kv("Action", action));
	if (isDeny) {
		if (verdict.source === "pi_check") {
			lines.push("");
			lines.push(PI_CHECK_DENY_HINT);
		}
		lines.push("");
		lines.push(remediationHint(verdict));
	}
	return lines.join("\n");
}

/** Stable `setStatus` key so a later verdict replaces Sage's own status line. */
const STATUS_KEY = "sage";

/**
 * pi and OMP both strip control characters (including newlines) from status
 * text, so the multi-line shield banner cannot live there. The status line
 * gets a one-line summary; the full banner goes to `confirm`'s message.
 */
function formatStatusLine(branding: Branding, state: string): string {
	return `🛡️ ${branding.name}: ${state}`;
}

function setShieldStatus(ui: HookUI | undefined, branding: Branding, state: string): void {
	try {
		ui?.setStatus(STATUS_KEY, formatStatusLine(branding, state));
	} catch {
		/* fail open — a flaky status backend must not change the verdict */
	}
}

/**
 * Hosts already wired in this process. A reload / re-init can call a factory
 * again on the same host; a second registration would stack duplicate
 * `tool_call` handlers (double prompts) and another cleanup timer. Keyed on
 * the host object so distinct hosts are unaffected.
 */
const registeredHosts = new WeakSet<HookHostAPI>();

/**
 * Wires the shared hook handlers onto `host`. Returns `false` when the host was
 * already registered and nothing was wired, so a connector factory can skip its
 * own one-time setup with `if (!registerHookHandlers(...)) return;`.
 */
export function registerHookHandlers(host: HookHostAPI, options: HookHandlerOptions): boolean {
	if (registeredHosts.has(host)) {
		options.logger?.warn(
			"registerHookHandlers called again for an already-registered host; skipping to avoid duplicate handlers and timers",
			{ agentRuntime: options.agentRuntime },
		);
		return false;
	}
	registeredHosts.add(host);
	const { adapter, logger, branding = defaultBranding, packageRoot, agentRuntime } = options;
	const ext = options.extensions ?? {};
	// A connector that renders its own status (pi's counts line) replaces the
	// default one-line shield; hooks are fail-open like the default.
	const showStatus = (ctx: ToolCallContext, state: string): void => {
		if (ext.renderStatus) {
			try {
				ext.renderStatus(ctx);
			} catch {
				/* display-only */
			}
			return;
		}
		setShieldStatus(ctx.ui, branding, state);
	};
	// pi and omp only hook the pre-execution tool_call event, so every
	// verdict this handler writes is a PreToolUse audit entry.
	const hookType: HookType = "PreToolUse";
	const approvalStore = options.approvalStore ?? new ApprovalStore();
	// Sweeps approvals that aged out (unresolved ones are deleted immediately).
	// These hosts are long-lived and one factory call serves every session, so
	// the unref'd interval runs for the process lifetime.
	startApprovalCleanup(approvalStore);
	const threatsDir = options.threatsDir ?? resolve(packageRoot, "resources", "threats");
	const trustedDomainsDir =
		options.trustedDomainsDir ?? resolve(packageRoot, "resources", "trusted-domains");

	// Show the shield in the status bar. Both events are needed: OMP emits
	// `session_start` while loading hooks (before this factory runs), so only
	// `agent_start` reaches it; pi delivers both.
	const showIdleShield = async (_event: unknown, ctx: ToolCallContext): Promise<undefined> => {
		showStatus(ctx, "✅");
		return undefined;
	};
	host.on("session_start", showIdleShield);
	host.on("agent_start", showIdleShield);

	if (ext.onToolResult) {
		const onToolResult = ext.onToolResult;
		host.on(
			"tool_result",
			async (
				event: ToolResultEvent,
				ctx: ToolCallContext,
			): Promise<ToolResultPatch | undefined> => {
				try {
					return await onToolResult(event, ctx);
				} catch (error) {
					// Output scanning is advisory: never alter the result on error.
					logger.error("Tool result handler error", { error: String(error) });
					return undefined;
				}
			},
		);
	}

	host.on(
		"tool_call",
		async (event: ToolCallEvent, ctx: ToolCallContext): Promise<ToolCallResult | undefined> => {
			try {
				const { toolName, input, toolCallId } = event;
				const sessionId = ctx.sessionManager?.getSessionId?.() ?? "unknown";

				// Map the tool call through the adapter
				const {
					toolName: canonicalName,
					toolInput,
					artifacts,
				} = adapter.mapToolCall(toolName, input, ctx.cwd);

				// E2E payload-drift capture; inert in production (env unset) and
				// fail-open inside captureHookInput. Namespaced per runtime so it
				// cannot collide with other agents sharing SAGE_E2E_CAPTURE_DIR.
				//
				// Follow-up: pi/omp still have no Layer 2 harness entry, so
				// host-schema drift is not caught automatically yet. See the
				// "Tracked gap" note in docs/developer-guide.md.
				if (captureEnabled()) {
					await captureHookInput(
						"PreToolUse",
						{ toolName, input, toolCallId, cwd: ctx.cwd },
						{ toolName: canonicalName, toolInput },
						{ filePrefix: `${agentRuntime}-` },
					);
				}

				// If no artifacts, pass through. Still refresh the shield: after a
				// deny/ask, later unguarded calls (OMP metadata tools, unknown tools)
				// would otherwise leave a stale "Blocked"/"Suspicious" banner up.
				if (artifacts.length === 0) {
					showStatus(ctx, "✅");
					return undefined;
				}

				// Action ID from the RAW input, so two calls that normalize to the
				// same toolInput (e.g. edits with different oldText but identical
				// newText) still get distinct approval entries.
				const rawActionId = ApprovalStore.actionId(canonicalName, input, sessionId);
				const guardResult = await guardToolCall(
					{
						toolName: canonicalName,
						toolInput,
						artifacts,
						sessionId,
						// sessionId is the only conversation key these hosts expose.
						conversationId: sessionId,
						agentRuntime,
						agentRuntimeVersion: options.agentRuntimeVersion,
						hookType,
						toolUseId: toolCallId,
					},
					{ logger, threatsDir, trustedDomainsDir },
					approvalStore,
					rawActionId,
				);

				const { verdict, actionId } = guardResult;

				if (verdict.decision !== "allow") {
					try {
						// Await so a status-file write started here completes before
						// renderStatus (below) reads it back — otherwise deny/declined
						// paths, which return straight after, can render stale counts.
						await ext.onNonAllow?.(sessionId, verdict, ctx);
					} catch {
						/* display-only */
					}
				}

				// Handle verdict — status line is a one-line summary (hosts strip
				// newlines); the full banner is the confirm dialog body.
				if (verdict.decision === "allow") {
					showStatus(ctx, "✅");
					return undefined;
				}

				if (verdict.decision === "deny") {
					const reason = formatShieldBanner(verdict, branding, "Blocked");
					showStatus(ctx, "🚨 Blocked");
					return { block: true, reason };
				}

				// Ask decision. confirm(title, message) — one argument puts the
				// whole banner in the title and leaves the body empty.
				const message = formatShieldBanner(verdict, branding, "Requires confirmation");
				showStatus(ctx, "⚠️ Suspicious");

				// Ask verdicts leave a pending entry so an approval can be recorded.
				// Every path that does not approve must drop it — otherwise a
				// decline, a headless run, or a failed dialog pins the entry
				// until the hourly stale sweep.
				const blockAsk = (reason: "declined" | "no_ui" | "prompt_failed"): ToolCallResult => {
					if (actionId) approvalStore.deletePending(actionId);
					return { block: true, reason: formatAskBlockMessage(verdict, reason, branding) };
				};

				// Check for UI
				if (!ctx.hasUI || !ctx.ui) {
					return blockAsk("no_ui");
				}

				try {
					const approved = await ctx.ui.confirm(
						`🛡️ ${branding.name}: Suspicious Activity Detected`,
						message,
					);
					if (!approved) {
						return blockAsk("declined");
					}
					// Mark as approved for future identical calls
					if (actionId) {
						approvalStore.approve(actionId);
					}
					try {
						ext.onApproved?.(event, verdict, artifacts, ctx);
					} catch {
						/* advisory only */
					}
					return undefined;
				} catch (e) {
					logger.error("Approval UI error", { error: e });
					return blockAsk("prompt_failed");
				}
			} catch (error) {
				logger.error("Hook handler error", { error });
				// Fail open on internal errors
				return undefined;
			}
		},
	);

	return true;
}
