import type { Decision, Logger } from "./types.js";
import { nullLogger } from "./types.js";

export interface PolicyThresholds {
	denyThreshold: number;
	askThreshold: number;
}

export const SENSITIVITY_POLICY: Record<string, PolicyThresholds> & {
	paranoid: PolicyThresholds;
	balanced: PolicyThresholds;
	relaxed: PolicyThresholds;
} = {
	paranoid: { denyThreshold: 0.7, askThreshold: 0.3 },
	balanced: { denyThreshold: 0.85, askThreshold: 0.5 },
	relaxed: { denyThreshold: 0.95, askThreshold: 0.7 },
};

// Invalid confidence is fail-open: log the offending value and treat as allow.
// This matches threat-loader.ts, which already drops out-of-range YAML rules at load time.
// Bundled threats and hardcoded signal confidences cannot reach this path, so any
// invalid value here indicates a bug in a signal source — surfaced in operational logs.
export function applyPolicy(
	confidence: number,
	denyThreshold: number,
	askThreshold: number,
	logger: Logger = nullLogger,
): Decision {
	if (!Number.isFinite(confidence) || confidence <= 0 || confidence > 1) {
		logger.warn("Invalid confidence; treating as allow", { confidence });
		return "allow";
	}
	if (confidence >= denyThreshold) return "deny";
	if (confidence >= askThreshold) return "ask";
	return "allow";
}
