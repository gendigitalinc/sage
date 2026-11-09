/**
 * Guard orchestrator for soft-gated connectors (OpenCode, OpenClaw).
 * Wraps evaluateToolCall with approval store checks, paranoid promotion,
 * and shared message formatting.
 */

import { ApprovalStore } from "./approval-store.js";
import { defaultBranding } from "./brands.js";
import { loadConfig } from "./config.js";
import type { ToolEvaluationContext, ToolEvaluationRequest } from "./evaluator.js";
import { allowVerdict, evaluateToolCall } from "./evaluator.js";
import { remediationHint, ruleLabel } from "./format.js";
import type { Artifact, Branding, Verdict } from "./types.js";
import { nullLogger } from "./types.js";

// ── guardToolCall ──────────────────────────────────────────────────

export interface GuardResult {
	verdict: Verdict;
	actionId?: string;
}

export async function guardToolCall(
	request: ToolEvaluationRequest,
	context: ToolEvaluationContext,
	approvalStore: ApprovalStore,
	actionIdOverride?: string,
): Promise<GuardResult> {
	const actionId =
		actionIdOverride ??
		ApprovalStore.actionId(request.toolName, request.toolInput, request.sessionId);

	if (approvalStore.isApproved(actionId)) {
		return { verdict: allowVerdict("approved") };
	}

	const verdict = await evaluateToolCall(request, context);

	if (verdict.decision === "allow" || verdict.decision === "deny") {
		return { verdict };
	}

	// ask verdict — check paranoid mode
	const logger = context.logger ?? nullLogger;
	const config = await loadConfig(context.configPath, logger);
	if (config.sensitivity === "paranoid") {
		return { verdict: { ...verdict, decision: "deny" } };
	}

	approvalStore.setPending(actionId, {
		artifacts: request.artifacts,
		createdAt: Date.now(),
	});

	return { verdict, actionId };
}

// ── Message formatting ─────────────────────────────────────────────

const MAX_ARTIFACT_VALUE_LEN = 120;

function truncateValue(value: string): string {
	const singleLine = value.replaceAll("\n", "\\n");
	if (singleLine.length <= MAX_ARTIFACT_VALUE_LEN) return singleLine;
	return `${singleLine.slice(0, MAX_ARTIFACT_VALUE_LEN)}…`;
}

export function summarizeArtifacts(artifacts: Artifact[]): string {
	if (artifacts.length === 0) return "none";
	const maxArtifacts = 3;
	const summary = artifacts
		.slice(0, maxArtifacts)
		.map((artifact) => `${artifact.type} '${truncateValue(artifact.value)}'`)
		.join(", ");
	const overflow = artifacts.length - maxArtifacts;
	return overflow > 0 ? `${summary}, ... and ${overflow} more` : summary;
}

export function formatDenyMessage(verdict: Verdict, branding: Branding = defaultBranding): string {
	const maxReasons = 5;
	const reasons =
		verdict.reasons.length > 0
			? verdict.reasons.slice(0, maxReasons).join("; ") +
				(verdict.reasons.length > maxReasons
					? `; ... and ${verdict.reasons.length - maxReasons} more`
					: "")
			: verdict.category;

	const rule = ruleLabel(verdict);

	return [
		`${branding.name} blocked this action.`,
		`Severity: ${verdict.severity}`,
		`Category: ${verdict.category}`,
		...(rule ? [`Rule: ${rule}`] : []),
		`Reason: ${reasons}`,
		remediationHint(verdict),
	].join("\n");
}

/**
 * Why an ask verdict was blocked without becoming an approval. Each case is
 * distinct so the model is not told a user declined when nobody was asked,
 * and each tells the model not to retry or work around the block.
 */
export type AskBlockReason = "declined" | "no_ui" | "prompt_failed";

const ASK_BLOCK_REASON: Record<AskBlockReason, (name: string) => string> = {
	declined: (name) =>
		`The user explicitly declined this action in the ${name} confirmation dialog.`,
	no_ui: (name) =>
		`No interactive UI is attached, so ${name} could not ask the user. This is not a user decision.`,
	prompt_failed: (name) =>
		`The ${name} confirmation dialog failed before the user could answer. This is not a user decision.`,
};

/**
 * Block text for an ask verdict that was not approved. Reuses the verdict
 * details from {@link formatDenyMessage} and replaces the closing hint with
 * a case-specific reason plus an instruction not to retry or work around it.
 */
export function formatAskBlockMessage(
	verdict: Verdict,
	reason: AskBlockReason,
	branding: Branding = defaultBranding,
): string {
	const hint = remediationHint(verdict);
	const details = formatDenyMessage(verdict, branding);
	const body = details.endsWith(hint)
		? details.slice(0, details.length - hint.length).trimEnd()
		: details;
	return [
		body,
		ASK_BLOCK_REASON[reason](branding.name),
		`Do not retry this tool call, do not rephrase it, and do not work around the block with another tool. Stop and tell the user ${branding.name} blocked it.`,
	].join("\n");
}

export async function approveAction(
	store: ApprovalStore,
	actionId: string,
	branding: Branding = defaultBranding,
): Promise<string> {
	const entry = store.approve(actionId);
	if (!entry) {
		return `No pending ${branding.name} approval found for this action ID.`;
	}
	return `Approved (${summarizeArtifacts(entry.artifacts)}). Retry the EXACT same tool call — do not modify the arguments.`;
}
