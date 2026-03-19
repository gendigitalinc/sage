# sage-cursor

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
