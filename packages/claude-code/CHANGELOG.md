# @gendigital/sage-claude-code

## 0.8.0

### Minor Changes

- Add white-label branding support. Product name, banner text, and extension command palette entries are configurable per installation via ~/.sage/branding.json.

## 0.7.0

### Minor Changes

- add shared MCP server package with false positive reporting and audit log tools
- Add per-session detection notifications: statusline file tracking in core, auto-configured Claude Code status line, IDE notifications in Cursor/VS Code extension, and TUI toasts in OpenCode. Fix OpenClaw E2E model default to match gateway API change.

### Patch Changes

- lower the hook timeout and unify its value across different connectors
- Switch E2E tests from dangerous-looking prompts to dummy canary rules that match benign marker strings, eliminating flaky model refusals.
- Fix marketplace migration check for new `known_marketplaces.json` object format (previously assumed array)

## 0.6.0

### Minor Changes

- Rename packages from `@sage/*` to `@gendigital/sage-*`, update GitHub org from `avast/sage` to `gendigitalinc/sage`, and add a one-time migration banner for Claude Code users still referencing the old marketplace URL.

### Patch Changes

- Extract command artifacts from JS/TS plugin files using regex-based detection of Node.js/Bun/zx command execution APIs. Add .mjs/.mts to scannable extensions.
- Move @gendigital/sage-core from dependencies to devDependencies in claude-code and extension packages (core is bundled by esbuild, not needed at runtime). Add prepack guard to core, openclaw, and opencode to reject publish with unresolved workspace: references when not using pnpm.

## 0.5.2

### Patch Changes

- Updated dependencies
  - @sage/core@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies
  - @sage/core@0.5.1

## 0.5.0

### Minor Changes

- Intercept Read tool for security checks (Claude Code, VS Code)

### Patch Changes

- Extend version check to allow for finer-grained version checking based on individual packages.
