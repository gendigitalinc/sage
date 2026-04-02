# @gendigital/sage-core

## 0.7.0

### Minor Changes

- new feature: exceptions - finer grained control over block/allow (replacing old allowlist which is now read only)
- Add per-session detection notifications: statusline file tracking in core, auto-configured Claude Code status line, IDE notifications in Cursor/VS Code extension, and TUI toasts in OpenCode. Fix OpenClaw E2E model default to match gateway API change.

### Patch Changes

- Fix OpenClaw security check FPs
- Fix marketplace migration check for new `known_marketplaces.json` object format (previously assumed array)
- add shared MCP server package with false positive reporting and audit log tools

## 0.6.0

### Minor Changes

- Add 17 new threat rules: copy/move evasion detection (CLT-CRED-007/008, CLT-WIN-CRED-010), deletion protection for .env, database, and .git (CLT-CMD-027/028/029), and file path rules for Android signing, Firebase, cloud creds, package manager tokens, Terraform state, vault/secrets, private keys/certs, kubeconfig, build system creds, shell history, and JetBrains DB creds (CLT-FILE-010..020).
- Extract command artifacts from JS/TS plugin files using regex-based detection of Node.js/Bun/zx command execution APIs. Add .mjs/.mts to scannable extensions.
- Rename packages from `@sage/*` to `@gendigital/sage-*`, update GitHub org from `avast/sage` to `gendigitalinc/sage`, and add a one-time migration banner for Claude Code users still referencing the old marketplace URL.

### Patch Changes

- Bypass OpenClaw security check false positives on Sage installation.
- Move @gendigital/sage-core from dependencies to devDependencies in claude-code and extension packages (core is bundled by esbuild, not needed at runtime). Add prepack guard to core, openclaw, and opencode to reject publish with unresolved workspace: references when not using pnpm.
- Stale entries in cache get ignored (and removed)

## 0.5.2

### Patch Changes

- Fix the version check URL and the changeset configuration for OpenClaw and OpenCode.

## 0.5.1

### Patch Changes

- Fixed cursor hooks not working in some cases.

## 0.5.0

### Minor Changes

- Intercept Read and Delete tools for security checks
- Add `extractFromRead` and `extractFromDelete` to core extractors
- Anti-malware Scan Interface (AMSI) integration on Windows
- 64 macOS-specific threat rules
- Unify approval store, guard orchestrator, and allowlist tool logic into core

### Patch Changes

- Guard fnUninitialize call during AMSI session open failure cleanup
- Fix CLT-CMD-006 false positives on `rm -rf /absolute/path` and add CLT-CMD-026 for critical system directory protection.
- Extend version check to allow for finer-grained version checking based on individual packages.
- Hardened config path resolution to prevent config directory escapes.
- Add FN/FP test coverage for threat detection rules; tighten CLT-CRED-003 to exclude .env.example, .env.sample, .env.template, and .env.dist writes (including compound forms like .env.local.example) while adding .prod, .stage, .dev, .test suffix coverage; align CLT-FILE-008 with path-segment boundary to avoid matching non-dotfile paths; exclude template suffixes from CLT-CRED-004 reads
