/**
 * Canonical tool vocabulary shared across all connectors.
 * Connectors own their platform-specific maps; core defines
 * the target vocabulary and a generic mapping helper.
 */

const CANONICAL_TOOLS = [
	"Bash",
	"WebFetch",
	"Write",
	"Edit",
	"Read",
	"Delete",
	"ApplyPatch",
	"Glob",
	"Grep",
	"List",
	"CodeSearch",
	"WebSearch",
	"Question",
	"Task",
	"ReadLines",
	"MCP",
	"Unknown",
] as const;

export type CanonicalToolType = (typeof CANONICAL_TOOLS)[number];

export const CANONICAL_SET: ReadonlySet<string> = new Set<string>(CANONICAL_TOOLS);

/**
 * Map a platform-specific tool name to a canonical type.
 * Already-canonical names pass through; unknown names return "Unknown".
 */
export function canonicalizeToolName(
	map: Record<string, CanonicalToolType>,
	rawName: string,
): CanonicalToolType {
	if (CANONICAL_SET.has(rawName)) return rawName as CanonicalToolType;
	return map[rawName] ?? "Unknown";
}
