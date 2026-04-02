# sage-cursor

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
