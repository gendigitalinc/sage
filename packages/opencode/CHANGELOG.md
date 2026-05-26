# @gendigital/sage-opencode

## 0.10.0

### Minor Changes

- Use native OpenCode approval dialog for ask verdicts instead of LLM-mediated chat

- Add configurable operational JSONL logging for Sage runtimes. Emit structured diagnostics from core evaluation, telemetry, hooks, MCP servers, and connector startup paths into `~/.sage/operational.jsonl`, with level filtering and rotation alongside the existing audit log behavior.

### Patch Changes

- Fix OpenCode approval flow: context.ask() returns Promise, not Effect — remove Effect.runPromise wrapper. Shorten actionId to 32 hex chars and echo original tool call in approval response.

- minor improvements to messaging and telemetry

- Updated dependencies:
  - Updated dependency `@gendigital/sage-core` to `0.10.0`

## 0.9.0

### Minor Changes

- Bundle brand definitions internally and resolve via `config.brand_key`. Replaces `product_name`/`banner_text` with `name` (full) and `short_name` (for space-constrained notification bubbles).
- improve audit log and telemetry to produce accurate data for verdict tracking and reporting issues

### Patch Changes

- Migrate VS Code extension from Claude Code hooks to Copilot's native hook system. Add tool name canonicalization to core. Fix toolInput field normalization across all connectors so evaluator AMSI scanning and package-reputation checks work correctly for non-Claude-Code platforms.

  - **opencode**: Normalize `filePath`/`newString` to `file_path`/`new_string` in write/edit toolInput

- Reduce E2E test flakiness: resolve branding dynamically in skill test, fix cross-test plugin contamination, fix missing Sage in isolated home test, tighten OpenCode system prompt, add retry tolerance
- Improve PI detection UX and add relaxed-mode suppression

  - Separate raw snippets from score formatting in BundledPiProvider findings
  - Add richer PI reason strings with file basenames, scores, and content snippets
  - Suppress medium-risk PI signals under sensitivity=relaxed (engine, evaluator, PostToolUse connectors)

- Updated dependencies
  - @gendigital/sage-core@0.9.0

## 0.8.0

### Minor Changes

- Add white-label branding support. Product name, banner text, and extension command palette entries are configurable per installation via ~/.sage/branding.json.

### Patch Changes

- Updated dependencies
  - @gendigital/sage-core@0.8.0

## 0.7.0

### Minor Changes

- Add per-session detection notifications: statusline file tracking in core, auto-configured Claude Code status line, IDE notifications in Cursor/VS Code extension, and TUI toasts in OpenCode. Fix OpenClaw E2E model default to match gateway API change.

### Patch Changes

- Switch E2E tests from dangerous-looking prompts to dummy canary rules that match benign marker strings, eliminating flaky model refusals.
- Updated dependencies [6e5d727]
- Updated dependencies [dd59f18]
- Updated dependencies [a3d7167]
- Updated dependencies [693ac93]
- Updated dependencies [069166d]
  - @gendigital/sage-core@0.7.0

## 0.6.0

### Minor Changes

- Rename packages from `@sage/*` to `@gendigital/sage-*`, update GitHub org from `avast/sage` to `gendigitalinc/sage`, and add a one-time migration banner for Claude Code users still referencing the old marketplace URL.

### Patch Changes

- Move @gendigital/sage-core from dependencies to devDependencies in claude-code and extension packages (core is bundled by esbuild, not needed at runtime). Add prepack guard to core, openclaw, and opencode to reject publish with unresolved workspace: references when not using pnpm.
- Updated dependencies [e4616d8]
  - @gendigital/sage-core@0.6.0

## 0.5.2

### Patch Changes

- Updated dependencies
  - @sage/core@0.5.2

## 0.5.0

### Minor Changes

- OpenCode connector, co-authored by FeiyouG
- Unify approval store, guard orchestrator, and allowlist tool logic into core. Fix OpenCode pendingFindings race condition.

### Patch Changes

- Extend version check to allow for finer-grained version checking based on individual packages.
- Promote ask verdicts to deny in paranoid mode to prevent prompt-injection auto-approval
