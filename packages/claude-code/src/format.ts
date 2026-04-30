/**
 * Formatting for Sage Claude Code alerts.
 * Shared formatting (severityEmoji, formatThreatBanner, etc.) lives in @gendigital/sage-core.
 * This file keeps Claude Code-specific verdict formatting.
 */

import type { Branding, Verdict } from "@gendigital/sage-core";
import {
	defaultBranding,
	kv,
	PAD,
	SEPARATOR_WIDTH,
	separatorLine,
	severityEmoji,
} from "@gendigital/sage-core";

export function artifactTypeLabel(type: string): string {
	if (type === "url") return "URL";
	if (type === "command") return "command";
	if (type === "file_path") return "file path";
	return type;
}

/** Append category and artifact details to lines array. */
function appendVerdictDetails(lines: string[], verdict: Verdict): void {
	lines.push(kv("Severity", verdict.severity.toUpperCase()));
	if (verdict.artifacts.length > 0) {
		// biome-ignore lint/style/noNonNullAssertion: length check above guarantees index 0 exists
		lines.push(kv("Artifact", verdict.artifacts[0]!));
		for (const a of verdict.artifacts.slice(1)) {
			lines.push(kv("", a));
		}
	}
	if (verdict.source && verdict.source !== "none") {
		lines.push(kv("Source", verdict.source));
	}
}

/**
 * Format block/ask reason for PreToolUse verdicts.
 * For deny: details-only block (this goes in systemMessage; permissionDecisionReason is plain "Blocked by Sage").
 * For ask: full branded banner with separator (shown once in confirmation dialog).
 */
export function formatBlockReason(verdict: Verdict, branding: Branding = defaultBranding): string {
	const isDeny = verdict.decision === "deny";
	const emoji = severityEmoji(verdict.severity);
	const reasonText = verdict.reasons.length > 0 ? verdict.reasons[0] : verdict.category;

	if (isDeny) {
		const header = `🛡️ ${branding.name}: Threat Blocked`;
		const lines: string[] = [header, separatorLine(SEPARATOR_WIDTH)];
		lines.push(`${emoji} ${"Threat".padEnd(PAD)}${reasonText}`);
		appendVerdictDetails(lines, verdict);
		lines.push(kv("Action", "Blocked"));
		if (verdict.source === "pi_check") {
			lines.push("");
			lines.push("Do NOT attempt to fetch this URL again or access it through alternative tools.");
			lines.push(
				"If this is a false positive, use the sage_report_false_positive MCP tool to report it.",
			);
		}
		return lines.join("\n");
	}

	const header = `🛡️ ${branding.name}: Suspicious Activity Detected`;
	const lines: string[] = [header, separatorLine(SEPARATOR_WIDTH)];
	lines.push(`${emoji} ${"Threat".padEnd(PAD)}${reasonText}`);
	appendVerdictDetails(lines, verdict);
	lines.push(kv("Action", "Requires confirmation"));
	return lines.join("\n");
}
