/**
 * Canonical canary marker strings for the E2E/integration suites. These MIRROR the `pattern:`
 * values in threats/dummy.yaml — the detection source of truth — and e2e-canary-markers.test.ts
 * asserts every value here exists there, so the two can't silently diverge. Import these instead
 * of hardcoding the opaque strings: a marker rotation then touches this file + dummy.yaml only
 * (not ~15 scattered literals), and a test-side typo becomes a compile error rather than a
 * silently-passing test (the const name doesn't exist).
 *
 * Names follow dummy.yaml's id matrix: `<tool><Decision>[Variant]` (e.g. DUMMY-CMD-DENY-001 →
 * `cmdDenyAlpha`). URL/domain values are the BARE host — the dummy.yaml rule appends `\.test`,
 * so tests compose the full `https://${…}.test/…` URL themselves.
 *
 * NOTE: the VS Code/Cursor Extension Host suite (e2e-suite/index.js) is hand-written runtime CJS
 * that can't import this module, so it keeps its own local copies — covered by the registry test.
 */
export const CANARY_MARKERS = {
	cmdDenyAlpha: "diagmark_cmd_a75bf229",
	cmdDenyBravo: "diagmark_run_c3d91e4a",
	cmdAskAlpha: "diagmark_cmd_8f2e6b71",
	cmdAskBravo: "diagmark_run_d4a09c53",
	cmdLog: "diagmark_cmd_1b7e3f82",
	fileDeny: "diagmark_file_e6c4a918",
	fileAsk: "diagmark_file_52fd7b36",
	fileLog: "diagmark_file_9a13de74",
	contentDeny: "diagmark_content_3c8f15b7",
	contentAsk: "diagmark_content_7d4ea2c9",
	contentLog: "diagmark_content_f0b683d1",
	urlDeny: "diaghost-4e91ca37",
	urlAsk: "diaghost-b26d80f5",
	urlLog: "diaghost-65f3d7a4",
	domainDeny: "diaghost-0c82eb16",
	cmdSubmit: "diagmark_cmd_d7e7127e",
	fileSubmit: "diagmark_file_57871281",
} as const;

/**
 * Regex SOURCE matching a canary marker in free text: `diagmark_<kind>_<hex>` (command/file/
 * content/run) or `diaghost-<hex>` (url/domain). Co-located with the markers so the naming
 * convention lives in one place. Exported as a string, not a RegExp: the `g` flag is stateful
 * (`lastIndex`), so each caller builds its own — e.g. `new RegExp(CANARY_MARKER_PATTERN, "g")`.
 */
export const CANARY_MARKER_PATTERN = "diagmark_[a-z]+_[0-9a-f]{6,}|diaghost-[0-9a-f]{6,}";
