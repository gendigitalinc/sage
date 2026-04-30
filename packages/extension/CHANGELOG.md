# sage-cursor

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
