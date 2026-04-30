# @gendigital/sage-openclaw

## 0.9.0

### Minor Changes

- Bundle brand definitions internally and resolve via `config.brand_key`. Replaces `product_name`/`banner_text` with `name` (full) and `short_name` (for space-constrained notification bubbles).
- improve audit log and telemetry to produce accurate data for verdict tracking and reporting issues

### Patch Changes

- Migrate VS Code extension from Claude Code hooks to Copilot's native hook system. Add tool name canonicalization to core. Fix toolInput field normalization across all connectors so evaluator AMSI scanning and package-reputation checks work correctly for non-Claude-Code platforms.

  - **openclaw**: Normalize `path` to `file_path` in write/edit toolInput

- Isolate HOME in openclaw tests to prevent branding config leakage.
- Improve PI detection UX and add relaxed-mode suppression

  - Separate raw snippets from score formatting in BundledPiProvider findings
  - Add richer PI reason strings with file basenames, scores, and content snippets
  - Suppress medium-risk PI signals under sensitivity=relaxed (engine, evaluator, PostToolUse connectors)

## 0.8.0

### Minor Changes

- Add white-label branding support. Product name, banner text, and extension command palette entries are configurable per installation via ~/.sage/branding.json.
- Replace sage_approve gate tool with OpenClaw native `requireApproval` mechanism for ask verdicts. Persistent allowlisting is now handled via `onResolution` callback — selecting "Allow always" saves an exception rule to ~/.sage/exceptions.json automatically. **Requires OpenClaw 2026.3.28 or later** (the release that added `requireApproval` to the plugin hook API).

## 0.7.0

### Patch Changes

- Switch E2E tests from dangerous-looking prompts to dummy canary rules that match benign marker strings, eliminating flaky model refusals.
- Fix OpenClaw security check FPs
- Add per-session detection notifications: statusline file tracking in core, auto-configured Claude Code status line, IDE notifications in Cursor/VS Code extension, and TUI toasts in OpenCode. Fix OpenClaw E2E model default to match gateway API change.

## 0.6.0

### Minor Changes

- Rename packages from `@sage/*` to `@gendigital/sage-*`, update GitHub org from `avast/sage` to `gendigitalinc/sage`, and add a one-time migration banner for Claude Code users still referencing the old marketplace URL.

### Patch Changes

- Move @sage/core from dependencies to devDependencies in the openclaw connector package.
- Bypass OpenClaw security check false positives on Sage installation.
- Move @gendigital/sage-core from dependencies to devDependencies in claude-code and extension packages (core is bundled by esbuild, not needed at runtime). Add prepack guard to core, openclaw, and opencode to reject publish with unresolved workspace: references when not using pnpm.

## 0.5.3

### Patch Changes

- Fix the configuration instructions inside README. Add an ask->deny promotion integration test.

## 0.5.2

### Patch Changes

- Updated dependencies
  - @sage/core@0.5.2

## 0.5.0

### Minor Changes

- Unify approval store, guard orchestrator, and allowlist tool logic into core. Add allowlist tools to OpenClaw.

### Patch Changes

- Extend version check to allow for finer-grained version checking based on individual packages.
- Promote ask verdicts to deny in paranoid mode to prevent prompt-injection auto-approval
