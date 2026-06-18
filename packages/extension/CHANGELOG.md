# sage-cursor

## 0.11.0

### Minor Changes

- Add 13 threat rules from [ATR (Agent Threat Rules)](https://github.com/Agent-Threat-Rule/agent-threat-rules) under MIT (ATR project). In `prompt-injection.yaml`: 4 rules (CLT-PI-052 MCP IMPORTANT-tag shadowing, CLT-PI-091 HTML-comment delivery, CLT-PI-092 jailbreak persona, CLT-PI-093 CJK pivot). In `agent-layer.yaml`: 9 rules covering MCP path traversal (CLT-MCP-004), skill-package compromise (CLT-SKL-001/002/004/005/006/008: mandatory override, base64 payload, hidden comment exfil, Unicode Tag smuggling, compound archival exfil, auto-approve rider), PEM key leak (CLT-CTX-003), and MCP filesystem typosquatting (CLT-SUPPLY-002). All rules match `content` artifacts (Write/Edit content and plugin/skill file scans).

- Tech debt removal: signal→policy architecture, legacy allowlist removal, and documentation.
  **Signal→Policy Architecture**
  Replace ACTION_MAP + demotion logic with two-threshold policy engine. Signal sources produce `{category, confidence}`; a policy function derives the decision via `deny_threshold`/`ask_threshold` per sensitivity preset.
  - Add `applyPolicy()` and `SENSITIVITY_POLICY` constant
  - Remove `ActionSchema`, `ACTION_MAP`, `DECISION_PRIORITY`, `CONFIDENCE_THRESHOLD`
  - Remove PI demotion exemption and medium-risk sensitivity suppression
  - Remove `action` field from YAML threat rules and `PluginFinding`/`PluginFindingData`
  - Add `flags` field to threat schema (supports `"report"` for telemetry-only rules)
  - Unify severity to 3-level scale (`critical`/`warning`/`info`); old 4-level YAML scale (`high`/`medium`/`low`) removed
  - Migrate 174 former `require_approval` rules to confidence 0.60
  - Migrate former `log` rules to confidence 0.10 with `flags: ["report"]`
  - Recalibrate package `suspicious_age` signal from 0.75 → 0.60
  - Add golden-file decision snapshot and signal source × sensitivity matrix tests
    **Remove legacy allowlist**
  - Delete `allowlist.ts`, types, and pipeline step
  - Rename `allowlistsDir` → `trustedDomainsDir` in `ToolEvaluationContext` and all connector call sites
  - Add one-time migration notice for users with existing `~/.sage/allowlist.json`
    **Decision pipeline documentation**
  - Add `docs/decision-pipeline.md` as single authoritative reference
  - Fix PI skip condition, remove dead command cache code, align package checker confidence values
    **Documentation consolidation**
  - Kill 13 audience-facing docs; content merged into `user-guide.md` and `developer-guide.md`
  - Keep 8 feature deep-dives as standalone reference (PI, packages, AMSI, plugin-scanning, audit-log, MCP, branding, decision-pipeline)

### Patch Changes

- Address agentic review findings: engine cleanup, directory rename, and correctness fixes.
  **Engine cleanup**

  - Remove dead `decision` field from internal `Signal` interface; per-signal `applyPolicy` calls were computed and stored but never read — the final decision is derived once from `max(confidences)`.
  - Allow verdicts now carry `confidence: 0.0` (was `1.0`); a no-threat verdict has zero threat signal, so 1.0 was semantically inverted. Audit log entries for allow decisions now reflect the correct value.
  - `packageVerdictToSignal` reads `pkg.confidence` from `PackageCheckResult` instead of hardcoding the same values — single source of truth, no divergence risk. Package cache-replay path updated to set per-verdict confidence (`malicious` → 1.0, `suspicious_age` → 0.6) to match.
  - `toAuditFindingData` simplified: removed redundant spread (`toFindingData` already returns a fresh object).
    **Directory rename**
  - `allowlists/` → `trusted-domains/` at repo root and in all package `resources/` copies. Aligns the physical directory name with the `trustedDomainsDir` field renamed in a previous commit.
    **Correctness fixes (post-refactor)**
  - Package cache replay: `packageVerdict` and `packageConfidence` are now read and written as an atomic pair — a cache hit no longer silently drops the package verdict, and malformed cache fields emit a warning instead of falling back to a stale allow.
  - URL verdict: fix deny bypass where a cached URL result could be returned as allow; fix verdict loop that could cause redundant upstream checks.
  - `custom_allowlist_path` detection: fix false negative where a non-default `trustedDomainsDir` was not recognised as the custom-path variant.
  - Threat loader: validate `confidence` at load time (reject rules with values outside `[0,1]`); fix OpenClaw plugin migration race on concurrent session starts.
  - Heuristic pre-filter: clarify in comments and docs that skipping allow results is semantically safe (allow heuristics never fire on allow-path inputs).
    **PR review follow-up**
  - `applyPolicy` now fails open on out-of-range confidence: logs a warning and returns `allow` instead of throwing `RangeError`. Unifies behavior with `threat-loader.ts` (which already log+skips invalid YAML rules) and preserves the audit trail when a future signal source feeds bad data.
  - Package cache replay: when cached `packageVerdict`/`packageConfidence` are invalid, the entry is treated as a cache miss and re-queried live instead of synthesizing a fallback verdict. Cache entries are version-scoped, so legacy entries written before these fields existed are evicted on version bump.
  - Docs: scrub legacy vendor reference from `decision-pipeline.md` and `plugin-scanner.ts` jsdoc; reword "threat author" → "threat rule author".

- Refresh outdated hook shims on startup.

- Report the host agent version (Claude Code, Cursor, VS Code) correctly.

- Section 5 quick fixes: MCP false-positive tools for OpenCode/OpenClaw, dead code removal, and docs cleanup.
  **MCP false-positive tools on OpenCode and OpenClaw**
  - OpenCode: plugin now auto-registers the Sage MCP server via a `config` hook (before MCP init). `sage_report_false_positive` and `sage_list_audit_entries` are available without any user configuration.
  - OpenClaw: ships a bundled `dist/mcp-server.cjs`; users add it to `mcp.servers` config manually (one-time step; documented in user-guide).
  - Both connectors: add `src/mcp-server.ts` entry point and `@gendigital/sage-mcp` dependency; bundle to `dist/mcp-server.cjs` via esbuild.
    **Recovery guidance on all deny verdicts**
  - `claude-code/format.ts`: `sage_report_false_positive` guidance now appended on every deny verdict (was PI-only). PI-only "don't re-fetch" wording kept gated.
  - `core/guard.ts` (`formatDenyMessage`): FP tool guidance added for OpenCode/OpenClaw deny messages.
    **Dead code removal**
  - `approval-store.ts`: remove `hasApprovedArtifact`, `consumeApprovedArtifact`, and private `findApprovedAction` (no production callers).
  - `approval-tracker.ts`: remove `findConsumedApproval`, `removeConsumedApproval`, `findConsumedApprovalAcrossSessions`, `removeConsumedApprovalAcrossSessions`, and private `listSessionFiles`.
    **Marketplace migration removal**
  - Delete `marketplace-migration.ts` module and its test (migration notice was flagged for removal after v0.7.x; current version is 0.10.0).
  - Remove `formatMigrationNotice` from `format.ts` and all exports/call sites in `session-start.ts`.
    **Other quick fixes**
  - `guard.ts` `summarizeArtifacts`: add `... and N more` overflow indicator (was silently truncating).
  - `CLAUDE.md`: add PostToolUse to Claude Code Connector architecture description.
  - `CONTRIBUTING.md`: remove duplicated threat-schema table (canonical version lives in `developer-guide.md`).
  - `.claude-plugin/plugin.json`: change description from "for Claude Code" to "for AI agents".
  - `skills/security-awareness/SKILL.md`: add MCP-tool platform-availability note.
  - `package.json` (openclaw/opencode/extension): remove redundant `pnpm -C ../core build` prefixes from `build`/`pretest` scripts; root `pnpm -r run build` topological order handles core-first.
  - `docs/mcp.md`, `docs/user-guide.md`: add OpenCode + OpenClaw to MCP supported clients.

## 0.10.0

### Minor Changes

- rebuild cursor hooks on each activation

- Add configurable operational JSONL logging for Sage runtimes. Emit structured diagnostics from core evaluation, telemetry, hooks, MCP servers, and connector startup paths into `~/.sage/operational.jsonl`, with level filtering and rotation alongside the existing audit log behavior.

### Patch Changes

- Add vscode:uninstall hook to clean up managed hook entries and shim scripts on extension removal. Always reinstall hooks on startup to self-heal stale paths after upgrades.

- minor improvements to messaging and telemetry

## 0.9.0

### Minor Changes

- Bundle brand definitions internally and resolve via `config.brand_key`. Replaces `product_name`/`banner_text` with `name` (full) and `short_name` (for space-constrained notification bubbles).
- Migrate VS Code extension from Claude Code hooks to Copilot's native hook system. Add tool name canonicalization to core. Fix toolInput field normalization across all connectors so evaluator AMSI scanning and package-reputation checks work correctly for non-Claude-Code platforms.

  - **extension**: Copilot hook installer, VS Code/Copilot CLI tool coverage, `apply_patch` rename extraction, shared installer infrastructure, drop workspace scope for both Cursor and VS Code

  **Breaking:** The `sage.cursor.scope` setting has been removed. Hooks are now always installed at user scope. Users who had this set to `"workspace"` will need to manually remove any leftover workspace-scoped hooks.

- Add session-start plugin scanning to VS Code/Cursor extension, aligning with Claude Code, OpenClaw, and OpenCode connectors. Scan co-installed extensions for threat patterns at IDE activation and surface findings via native notifications.
- Add ML-based prompt injection detection (heuristic rules + ONNX model)
- improve audit log and telemetry to produce accurate data for verdict tracking and reporting issues

## 0.8.0

### Minor Changes

- Add white-label branding support. Product name, banner text, and extension command palette entries are configurable per installation via ~/.sage/branding.json.

## 0.7.0

### Minor Changes

- add shared MCP server package with false positive reporting and audit log tools
- Add per-session detection notifications: statusline file tracking in core, auto-configured Claude Code status line, IDE notifications in Cursor/VS Code extension, and TUI toasts in OpenCode. Fix OpenClaw E2E model default to match gateway API change.
- make Sage auto enable in Cursor/VSCode after session restart if it was disabled

### Patch Changes

- lower the hook timeout and unify its value across different connectors
- Switch E2E tests from dangerous-looking prompts to dummy canary rules that match benign marker strings, eliminating flaky model refusals.

## 0.6.0

### Minor Changes

- Rename packages from `@sage/*` to `@gendigital/sage-*`, update GitHub org from `avast/sage` to `gendigitalinc/sage`, and add a one-time migration banner for Claude Code users still referencing the old marketplace URL.

### Patch Changes

- Move @gendigital/sage-core from dependencies to devDependencies in claude-code and extension packages (core is bundled by esbuild, not needed at runtime). Add prepack guard to core, openclaw, and opencode to reject publish with unresolved workspace: references when not using pnpm.

## 0.5.2

### Patch Changes

- Updated dependencies
  - @sage/core@0.5.2

## 0.5.1

### Patch Changes

- Fixed cursor hooks not working in some cases.
- Updated dependencies
  - @sage/core@0.5.1

## 0.5.0

### Minor Changes

- Add `extractFromRead` and `extractFromDelete` to core extractors

### Patch Changes

- Fix possible shell injection in Cursor and VS Code hooks.
- Extend version check to allow for finer-grained version checking based on individual packages.
