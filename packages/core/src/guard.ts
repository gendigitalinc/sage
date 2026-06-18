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
): Promise<GuardResult> {
	const actionId = ApprovalStore.actionId(request.toolName, request.toolInput, request.sessionId);

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

	return [
		`${branding.name} blocked this action.`,
		`Severity: ${verdict.severity}`,
		`Category: ${verdict.category}`,
		`Reason: ${reasons}`,
		`If this is a false positive, use the sage_report_false_positive MCP tool to report it.`,
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
