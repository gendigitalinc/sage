# @gendigital/sage-core

## 0.10.0

### Minor Changes

- Add configurable operational JSONL logging for Sage runtimes. Emit structured diagnostics from core evaluation, telemetry, hooks, MCP servers, and connector startup paths into `~/.sage/operational.jsonl`, with level filtering and rotation alongside the existing audit log behavior.

### Patch Changes

- Fix OpenCode approval flow: context.ask() returns Promise, not Effect — remove Effect.runPromise wrapper. Shorten actionId to 32 hex chars and echo original tool call in approval response.

- minor improvements to messaging and telemetry

- Use native OpenCode approval dialog for ask verdicts instead of LLM-mediated chat

## 0.9.0

### Minor Changes

- Bundle brand definitions internally and resolve via `config.brand_key`. Replaces `product_name`/`banner_text` with `name` (full) and `short_name` (for space-constrained notification bubbles).
- Migrate VS Code extension from Claude Code hooks to Copilot's native hook system. Add tool name canonicalization to core. Fix toolInput field normalization across all connectors so evaluator AMSI scanning and package-reputation checks work correctly for non-Claude-Code platforms.

  - **core**: Add `CanonicalToolType` vocabulary and `canonicalizeToolName()` helper

- Restrict ML pi_check to WebFetch pre-fetch with content-type filtering

  Move the ML prompt-injection classifier from a broad post-tool-use scan (all tools) to a targeted pre-tool-use pre-fetch on WebFetch only. Sage now fetches URL content itself, checks it against an extension allowlist and content-sniffing heuristics, then runs the PI classifier before the agent sees the page.

  - Add ContentFetchClient for HTTP pre-fetching with MIME filtering
  - Raise thresholds: high-risk 0.5→0.99 (deny), medium-risk 0.1→0.5 (warn)
  - Extension allowlist gates which URLs get scanned
  - Content sniffing fallback for extensionless URLs
  - Force-log audit entries when any signals fire, even on allow verdicts

- Improve PI detection UX and add relaxed-mode suppression

  - Separate raw snippets from score formatting in BundledPiProvider findings
  - Add richer PI reason strings with file basenames, scores, and content snippets
  - Suppress medium-risk PI signals under sensitivity=relaxed (engine, evaluator, PostToolUse connectors)

- Add skill analyzer: content-addressable skill ID computation and skill-check API client for detecting risky skill packages during plugin scanning
- Add ML-based prompt injection detection (heuristic rules + ONNX model)
- improve audit log and telemetry to produce accurate data for verdict tracking and reporting issues

### Patch Changes

- 13c21ce: Add session-start plugin scanning to VS Code/Cursor extension, aligning with Claude Code, OpenClaw, and OpenCode connectors. Scan co-installed extensions for threat patterns at IDE activation and surface findings via native notifications.
- fd96942: fix pi-deps-installer treating partial/broken onnxruntime-node directories as valid installs

## 0.8.0

### Minor Changes

- Add white-label branding support. Product name, banner text, and extension command palette entries are configurable per installation via ~/.sage/branding.json.
- new community iq feature to improve detection capabilities

### Patch Changes

- fix: package check will no longer incorrectly handle shortened or composite version specification for npm packages; PyPI package check is now also more robust and only validates version for exact version specification

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
