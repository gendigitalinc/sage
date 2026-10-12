import type { PackageCheckResult, Threat } from "./types.js";

/** Canonical ML prompt-injection detection name. Model IDs and scores stay in structured fields. */
export const PI_DETECTION_NAME = "Other:SagePromptInjectionML-A [Susp]";

/** Four-letter engine identifiers prepended to optional report metadata. */
export const REPORTING_ENGINE_SHORTHANDS = {
	package: "sgpk",
	amsi: "sgam",
	heuristics: "sghe",
	ml: "sgml",
	skill: "skan",
} as const;

/** Common suffix for every Sage-owned reporting detection name. */
export const REPORTING_DETECTION_SUFFIX = "sage";

export type ReportingDetectionEngine = keyof typeof REPORTING_ENGINE_SHORTHANDS;

/**
 * Format `<canonical>|<engine shorthand>[:<optional data>]|sage` for audit,
 * telemetry, and false-positive reports. User-facing surfaces must continue
 * using the unsuffixed canonical name.
 */
export function formatReportingDetectionName(
	canonicalName: string,
	engine: ReportingDetectionEngine,
	optionalData = "",
): string {
	const engineMetadata = optionalData
		? `${REPORTING_ENGINE_SHORTHANDS[engine]}:${optionalData}`
		: REPORTING_ENGINE_SHORTHANDS[engine];
	return `${canonicalName}|${engineMetadata}|${REPORTING_DETECTION_SUFFIX}`;
}

export type PackageDetectionVerdict = Exclude<PackageCheckResult["verdict"], "clean">;

/** Stable package-check identities. Package coordinates stay in structured fields. */
export const PACKAGE_DETECTION_NAMES: Readonly<Record<PackageDetectionVerdict, string>> = {
	not_found: "Other:SagePackageNotFound-A [Susp]",
	suspicious_age: "Other:SagePackageNew-A [Susp]",
	malicious: "Other:SagePackageMalicious-A [Trj]",
	unknown: "Other:SagePackageUnknown-A [Susp]",
};

export type AmsiDetectionClass = "detected" | "blocked_by_admin" | "unknown";

/** Stable AMSI result-class identities. Raw result codes stay in `amsi_result`. */
export const AMSI_DETECTION_NAMES: Readonly<Record<AmsiDetectionClass, string>> = {
	detected: "Other:SageAmsiDetected-A [Heur]",
	blocked_by_admin: "Other:SageAmsiBlockedByAdmin-A [Heur]",
	unknown: "Other:SageAmsiUnknown-A [Susp]",
};

/** Stable rule names used in the optional-data segment of AMSI reports. */
export const AMSI_REPORTING_RULE_NAMES: Readonly<Record<AmsiDetectionClass, string>> = {
	detected: "AMSI_DETECTED",
	blocked_by_admin: "AMSI_BLOCKED_BY_ADMIN",
	unknown: "AMSI_UNKNOWN",
};

export type SkillDetectionVerdict = "HIGH" | "CRITICAL";

export interface SkillCheckSignal {
	detection_name: string;
	skill_id: string;
	job_id?: string;
	analyzer_verdict: SkillDetectionVerdict;
}

/** Stable Skill Analyzer identities. Skill content hashes stay in report metadata. */
export const SKILL_DETECTION_NAMES: Readonly<Record<SkillDetectionVerdict, string>> = {
	HIGH: "Other:SageSuspiciousSkill-A [Susp]",
	CRITICAL: "Other:SageMaliciousSkill-A [Trj]",
};

export interface DetectionNameCatalogEntry {
	source: "heuristic" | "pi" | "package" | "amsi" | "skill";
	key: string;
	detectionName: string;
}

/**
 * Strict local shape check for the canonical subset Sage emits.
 */
export function isCanonicalDetectionName(name: string): boolean {
	return /^\w+:\w+-[A-Z]+ \[[^\]\r\n]+\]$/.test(name);
}

export function packageDetectionName(verdict: PackageDetectionVerdict): string {
	return PACKAGE_DETECTION_NAMES[verdict];
}

function amsiDetectionClass(amsiResult: number): AmsiDetectionClass {
	if (amsiResult >= 0x8000) return "detected";
	if (amsiResult >= 0x4000) return "blocked_by_admin";
	return "unknown";
}

export function amsiDetectionName(amsiResult: number): string {
	return AMSI_DETECTION_NAMES[amsiDetectionClass(amsiResult)];
}

/** `<AMSI rule name>:<lowercase hexadecimal result without 0x>`. */
export function amsiReportingData(amsiResult: number): string {
	const ruleName = AMSI_REPORTING_RULE_NAMES[amsiDetectionClass(amsiResult)];
	return `${ruleName}:${Math.trunc(amsiResult).toString(16)}`;
}

export function skillDetectionName(verdict: string): string | undefined {
	return SKILL_DETECTION_NAMES[verdict.toUpperCase() as SkillDetectionVerdict];
}

/** Skill IDs are lowercase SHA-256 content hashes; uppercase is accepted for legacy data. */
export function isSkillId(value: string): boolean {
	return /^[0-9a-f]{64}$/i.test(value);
}

/** Reporting identity for a risky Skill Analyzer result, keyed by its full content hash. */
export function skillReportingDetectionName(verdict: string, skillId: string): string | undefined {
	const canonicalName = skillDetectionName(verdict);
	return canonicalName && isSkillId(skillId)
		? formatReportingDetectionName(canonicalName, "skill", skillId.toLowerCase())
		: undefined;
}

/** Normalize and construct one reportable Skill Analyzer audit signal. */
export function buildSkillCheckSignal(
	skillId: string,
	analyzerVerdict: string,
	jobId?: string,
): SkillCheckSignal | undefined {
	const normalizedSkillId = skillId.toLowerCase();
	const normalizedVerdict = analyzerVerdict.toUpperCase();
	const detectionName = skillReportingDetectionName(normalizedVerdict, normalizedSkillId);
	if (!detectionName) return undefined;
	return {
		detection_name: detectionName,
		skill_id: normalizedSkillId,
		...(jobId ? { job_id: jobId } : {}),
		analyzer_verdict: normalizedVerdict as SkillDetectionVerdict,
	};
}

/** Build a review/export catalog for local uniqueness checks. */
export function buildDetectionNameCatalog(
	threats: readonly Pick<Threat, "id" | "detectionName">[],
): DetectionNameCatalogEntry[] {
	return [
		...threats.map((threat) => ({
			source: "heuristic" as const,
			key: threat.id,
			detectionName: threat.detectionName,
		})),
		{ source: "pi", key: "prompt_injection", detectionName: PI_DETECTION_NAME },
		...Object.entries(PACKAGE_DETECTION_NAMES).map(([key, detectionName]) => ({
			source: "package" as const,
			key,
			detectionName,
		})),
		...Object.entries(AMSI_DETECTION_NAMES).map(([key, detectionName]) => ({
			source: "amsi" as const,
			key,
			detectionName,
		})),
		...Object.entries(SKILL_DETECTION_NAMES).map(([key, detectionName]) => ({
			source: "skill" as const,
			key,
			detectionName,
		})),
	];
}
