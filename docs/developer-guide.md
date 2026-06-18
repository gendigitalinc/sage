# Developer Guide

Reference for contributors. Covers the monorepo architecture, development workflow, and threat rule format.

---

## Architecture

Sage is a TypeScript monorepo with a shared core library and platform-specific connectors.

### Packages

```
packages/
├── core/          @gendigital/sage-core         Platform-agnostic detection engine
├── claude-code/   @gendigital/sage-claude-code   Claude Code hook entry points
├── openclaw/      @gendigital/sage-openclaw       OpenClaw plugin connector
├── opencode/      @gendigital/sage-opencode       OpenCode plugin connector
└── extension/     sage-cursor                     Cursor and VS Code extensions (unscoped: vsce rejects @ and / in extension names)
```

### Core Library Modules

`@gendigital/sage-core` contains all detection logic. It has no platform dependencies and is imported by all connectors.

| Module | Purpose |
|--------|---------|
| `extractors.ts` | Extracts URLs, commands, file paths from tool inputs |
| `heuristics.ts` | Matches artifacts against YAML threat patterns |
| `engine.ts` | Decision engine — combines signals into a Verdict |
| `threat-loader.ts` | Loads YAML threat definitions |
| `config.ts` | Config loading and validation (Zod schemas) |
| `cache.ts` | JSON file verdict cache with TTLs |
| `audit-log.ts` | JSONL audit logging |
| `trusted-domains.ts` | Trusted domain loading and matching |
| `tool-names.ts` | Canonical tool vocabulary and generic canonicalization helper |
| `plugin-scanner.ts` | Plugin file scanning |
| `package-checker.ts` | npm/PyPI supply-chain checks |
| `installation-id.ts` | Persistent installation UUID (`~/.sage/installation-id`) |
| `version-check.ts` | Version check via POST with environment context |
| `session-start.ts` | Session start orchestrator (scan + version check) |
| `clients/url-check.ts` | URL reputation API client and endpoint resolver |
| `clients/file-check.ts` | File reputation API client |
| `clients/package-registry.ts` | npm/PyPI registry client |
| `content-snapshot.ts` | Structured `content` snapshot builder (per-field caps + home-path scrubbing) shared by audit log, detection telemetry, and FP reporting |
| `extended-info.ts` | `~/.sage/extended-info.json` loader/sanitizer + `mergeExtendedInfo` helper |
| `product-version.ts` | Platform-agnostic `product.json` version reader used by hook runner and MCP server child processes |

### Connector Architecture

**Claude Code** (`packages/claude-code/src/`):

Bundled MCP server plus session-start command entry point:

- **`mcp-server.ts`** — Starts the long-lived Sage MCP server and registers Claude hook tools.
- **`mcp-hook-tools.ts`** — Exposes PreToolUse/PostToolUse hook handling as MCP tools.
- **`session-start.ts`** — Scans installed plugins for threats.

Registered via `.claude-plugin/plugin.json` and `hooks/hooks.json`.

**OpenClaw** (`packages/openclaw/src/`):

In-process plugin using `api.on('before_tool_call')`:

- **`tool-handler.ts`** — Intercepts tool calls, runs detection pipeline, returns `requireApproval` for flagged actions.
- **`startup-scan.ts`** — Plugin scanning at gateway/session start.

**Extension** (`packages/extension/src/`) — Cursor / VS Code:

VS Code API extension with platform-specific installers:

- **`shared_extension.ts`** — Registers commands: enable protection, disable until restart, open config, show hook health.
- **`hook_installer_shared.ts`** — Shared hook installer utilities (runner resolution, shim creation, managed entry helpers).
- **`cursor_hook_installer.ts`** — Install managed hooks into Cursor (`~/.cursor/hooks.json`).
- **`vscode_hook_installer.ts`** — Install managed hooks into Copilot (`~/.copilot/hooks/hooks.json`). This path is shared with Copilot CLI, so installed hooks also protect CLI agent sessions.

### Data Flow

**Claude Code:**

```
mcp_tool hook call → Sage MCP server → normalize hook input → canonicalize tool name
  → extract artifacts → check exceptions → check cache
  → heuristics + URL check + package check → DecisionEngine
  → cache result → audit log → hook tool result (JSON)
```

Claude Code hooks exit 0. Errors return an `allow` verdict.

**OpenClaw:**

```
before_tool_call event → canonicalize tool name → extract artifacts → check exceptions → check cache
  → heuristics + URL check + package check → DecisionEngine
  → cache result → audit log → block/pass
```

Flagged actions return a `requireApproval` object that triggers native platform approval dialogs. An `onResolution` callback persists an exception entry when the user selects "Allow always".

**Cursor / VS Code:**

```
Managed hook intercepts tool call → spawns sage-hook.cjs subprocess
  → canonicalize tool name → extract artifacts → check exceptions → check cache
  → heuristics + URL check + package check → DecisionEngine
  → cache result → audit log → return verdict
```

Extension hooks always exit with code `0`; the host reads the JSON response to enforce blocking.

### Key Design Decisions

- **All patterns are data.** Detection rules live in `threats/*.yaml`, not in code. This makes rules easy to review, contribute, and update independently.
- **Fail-open.** Every error path returns `allow`. Sage should never break the agent.
- **Shared core.** All platforms use the same `@gendigital/sage-core` library, ensuring consistent detection regardless of connector.
- **No runtime dependencies beyond Node.js.** The core uses native `fetch`, `yaml` for YAML parsing, and `zod` for validation. Connectors are bundled into single CJS files.
- **Connectors own tool name canonicalization.** Core defines the canonical vocabulary (`CanonicalToolType`) but has no knowledge of platform-specific names. Each connector maps its raw tool names to canonical form before calling the evaluator.

---

## Development

### Setup

```bash
git clone https://github.com/gendigitalinc/sage
cd sage
git checkout pre-release
pnpm install    # also installs git hooks automatically
pnpm build
```

Development happens on the `pre-release` branch. The `main` branch is the distribution channel (what users install). See [CONTRIBUTING.md](../CONTRIBUTING.md#branch-policy) for details.

Requires Node.js >= 18 and pnpm >= 9.

### Git Hooks

Git hooks are installed automatically by `pnpm install` (via `core.hooksPath`). No external framework required — just bash scripts in `scripts/git-hooks/`.

| Stage | Checks | Speed |
|-------|--------|-------|
| **pre-commit** | gitleaks, private key detection, lint | Fast |
| **pre-push** | build, typecheck, test, changeset check | Slow (fails fast) |

**Required:** Install [gitleaks](https://github.com/gitleaks/gitleaks) for secret scanning (`brew install gitleaks` / `choco install gitleaks`). The pre-commit hook will refuse to commit without it.

### Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages (tsc + esbuild) |
| `pnpm test` | Run unit + integration tests (builds automatically) |
| `pnpm test -- --reporter=verbose` | Verbose test output |
| `pnpm test -- <file>` | Run a single test file |
| `pnpm test -- -t "name"` | Run tests matching name |
| `pnpm test:e2e` | All E2E tests (Claude Code + OpenClaw + OpenCode + Cursor + VS Code + Copilot CLI) |
| `pnpm test:e2e:claude` | Claude Code E2E tests only |
| `pnpm test:e2e:openclaw` | OpenClaw E2E tests only |
| `pnpm test:e2e:opencode` | OpenCode E2E tests only |
| `pnpm test:e2e:cursor` | Cursor extension E2E tests only |
| `pnpm test:e2e:vscode` | VS Code extension E2E tests only |
| `pnpm test:e2e:copilot-cli` | Copilot CLI E2E tests only |
| `pnpm build:sea` | Build standalone SEA binaries |
| `pnpm lint` | Lint with Biome |
| `pnpm lint:fix` | Lint + auto-fix |
| `pnpm check` | Type check all packages |
| `pnpm changeset` | Create a changeset for your changes |
| `pnpm run version` | Apply changesets: bump versions, generate changelogs, sync manifests |
| `pnpm eval:pi` | PI accuracy benchmark (requires model at `~/.sage/models/<schema>/pi-model/`) |

### Test Tiers

| Tier | Scope | Files | Requires |
|------|-------|-------|----------|
| Unit | Core library | `packages/core/src/__tests__/*.test.ts` | dev deps only |
| Integration | Hook/plugin entry points | `packages/claude-code/src/__tests__/`, `packages/openclaw/src/__tests__/e2e-integration.test.ts`, `packages/opencode/src/__tests__/integration.test.ts` | dev deps only |
| E2E (Claude Code) | Full plugin in Claude CLI | `packages/claude-code/src/__tests__/e2e.test.ts` | `claude` CLI + `ANTHROPIC_API_KEY` |
| E2E (OpenClaw) | Full plugin in OpenClaw gateway | `packages/openclaw/src/__tests__/e2e.test.ts` | OpenClaw gateway + `OPENCLAW_GATEWAY_TOKEN` |
| E2E (OpenCode) | OpenCode CLI smoke test | `packages/opencode/src/__tests__/e2e.test.ts` | OpenCode CLI executable |
| E2E (Cursor extension) | Sage extension in Cursor Extension Host | `packages/extension/src/__tests__/e2e.test.ts` | Installed Cursor executable (`agent` CLI required for headless Cursor-agent sub-suite) |
| E2E (VS Code extension) | Sage extension in VS Code Extension Host | `packages/extension/src/__tests__/e2e.test.ts` | Installed VS Code executable |
| E2E (Copilot CLI) | Sage hooks in Copilot CLI | `packages/extension/src/__tests__/e2e-copilot-cli.test.ts` | `copilot` CLI + GitHub auth |

`pnpm test` runs unit and integration tests. E2E is excluded — run separately with `pnpm test:e2e` or the per-platform variants.

### Regression Baselines

The decision engine has golden-file tests that lock its current behavior so refactoring phases can prove they didn't regress.

| Test | File | Purpose |
|------|------|---------|
| Decision snapshot | `packages/core/src/__tests__/decision-snapshot.test.ts` | Runs all threat rules through `DecisionEngine` at each sensitivity, compares against committed fixture |
| Signal source matrix | `packages/core/src/__tests__/engine-signal-matrix.test.ts` | Exhaustive source × outcome × sensitivity coverage for URL, package, AMSI, and PI signals |
| Policy boundary | `packages/core/src/__tests__/policy.test.ts` | Boundary tests for `applyPolicy` |

**Regenerating the decision snapshot:** If you intentionally change engine behavior (e.g., recalibrating confidence values), regenerate the fixture:

```bash
UPDATE_DECISION_SNAPSHOT=1 npx vitest run packages/core/src/__tests__/decision-snapshot.test.ts
```

Review the diff in `packages/core/src/__tests__/fixtures/decision-snapshot.json` and commit the updated fixture.

### Dummy Canary Rules

E2E tests use dummy canary rules (`threats/dummy.yaml`) instead of real threat patterns. The canary rules match harmless, highly-specific marker strings (e.g. `__sage_test_deny_cmd_a75bf229__`) that would never appear in real usage. This avoids AI models self-refusing "dangerous-looking" prompts before Sage gets a chance to intercept them. Canary rules are included in all distribution packages alongside real threat definitions.

### E2E Setup

#### Claude Code

**Prerequisites:** `claude` CLI in PATH, valid `ANTHROPIC_API_KEY`, and Sage must **not** be installed via the Claude Code marketplace (duplicate-plugin conflict with `--plugin-dir`).

```bash
pnpm build
claude --plugin-dir .
```

#### Cursor / VS Code

The extension E2E tests run inside a real Extension Host process using installed IDE binaries.

**Prerequisites:**

- Cursor E2E: installed Cursor executable
- Cursor headless agent E2E: `agent` CLI in `PATH` (or `SAGE_AGENT_PATH`), authenticated via `agent login` or `CURSOR_API_KEY`
- VS Code E2E: installed VS Code executable
- Extension must be built (handled by Vitest `globalSetup`)

**Optional executable overrides:**

| Variable | Description |
|----------|-------------|
| `SAGE_CURSOR_PATH` | Absolute path to the Cursor executable |
| `SAGE_AGENT_PATH` | Absolute path to the `agent` CLI used by Cursor headless E2E |
| `SAGE_VSCODE_PATH` | Absolute path to the VS Code executable |
| `VSCODE_EXECUTABLE_PATH` | Alternate VS Code executable override |

If a requested host executable is unavailable, that host's E2E suite is skipped. If `agent` is unavailable or unauthenticated, the Cursor headless agent sub-suite is skipped and remaining Cursor host E2E tests still run.

#### Copilot CLI

The Copilot CLI E2E tests load Sage as a plugin via `--plugin-dir` and verify that Copilot CLI respects hook verdicts. No changes are made to the real `~/.copilot/` directory.

**Prerequisites:**

- `copilot` CLI in PATH (install via [GitHub Copilot CLI docs](https://docs.github.com/copilot/how-tos/copilot-cli))
- Authenticated: `copilot login`, or set `GITHUB_TOKEN` / `GH_TOKEN` / `COPILOT_GITHUB_TOKEN`

The suite auto-skips if `copilot` is not in PATH. It does **not** detect missing auth — if the CLI is present but not authenticated, tests will fail with auth errors rather than skipping.

**Optional environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `COPILOT_E2E_MODEL` | `claude-haiku-4.5` | Model to use for E2E tests |

#### OpenClaw

**Prerequisites:** A running OpenClaw gateway with Sage installed. The tests read `~/.openclaw/openclaw.json` for the auth token and check that the chat completions endpoint is enabled. Tests skip automatically if either is missing.

Enable the endpoint in `~/.openclaw/openclaw.json`:

```json
{
  "gateway": {
    "http": {
      "endpoints": {
        "chatCompletions": { "enabled": true }
      }
    }
  }
}
```

**Optional environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCLAW_GATEWAY_TOKEN` | read from `~/.openclaw/openclaw.json` | Override the gateway auth token |
| `OPENCLAW_E2E_HOST` | `http://localhost:18789` | Gateway URL |
| `OPENCLAW_E2E_MODEL` | `claude-3-5-haiku-latest` | Model to use |

**Running the gateway with Docker:**

Use OpenClaw's `OPENCLAW_EXTRA_MOUNTS` to mount the built Sage plugin into the gateway container. Set the variable before running `docker-setup.sh`, which generates `docker-compose.extra.yml` with the mount:

```bash
# Build Sage first
pnpm build

# Set the mount and run setup (generates docker-compose.extra.yml)
export OPENCLAW_EXTRA_MOUNTS="SAGE_PROJECT_DIR/packages/openclaw:/home/node/.openclaw/extensions/sage:ro"
./docker-setup.sh

# If the gateway is already set up, re-run docker-setup.sh to regenerate
# the extra compose file, then restart:
docker compose up -d
```

This mounts the built `packages/openclaw/` directory into the gateway's extensions directory where plugin discovery finds it. See the [OpenClaw Docker guide](https://docs.openclaw.ai/install/docker) for details.

**Tip:** Disable the security awareness skill on the gateway agent during E2E testing. The skill teaches the model to recognise dangerous patterns, which can cause it to self-refuse commands instead of calling the tool and letting Sage's `before_tool_call` hook handle them.

### Project Layout

```
sage/
├── packages/
│   ├── core/           @gendigital/sage-core - detection engine
│   ├── claude-code/    @gendigital/sage-claude-code - Claude Code hooks
│   ├── openclaw/       @gendigital/sage-openclaw - OpenClaw connector
│   ├── opencode/       @gendigital/sage-opencode - OpenCode plugin
│   └── extension/      Cursor and VS Code extensions
├── threats/            YAML threat definitions
├── trusted-domains/     Trusted domain allowlists
├── hooks/              hooks.json for Claude Code
├── skills/             Security awareness skill
└── scripts/            Build utilities
```

### Tooling

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 18 | Runtime |
| pnpm | >= 9 | Workspace management |
| TypeScript | ^5.9 | Type checking |
| esbuild | ^0.25 | Bundle hooks into single CJS files |
| Biome | ^1.9 | Linting + formatting |
| vitest | ^4.0 | Test runner |
| zod | ^3.24 | Schema validation |
| yaml | ^2.7 | YAML parsing |

### Conventions

- **Naming split:** YAML/JSON data uses `snake_case` (`threat_id`, `source_file`). TypeScript uses `camelCase` (`threatId`, `sourceFile`). Conversion functions handle the boundary.
- **Fail-open:** Every internal error path must return an `allow` verdict. Extension hooks always exit with code `0`.
- **Detection patterns are data.** No hardcoded patterns — all rules live in `threats/*.yaml`.

### Versioning

This project uses [Changesets](https://github.com/changesets/changesets) with **linked mode** — all five packages sync versions when released together, but individual packages can be bumped independently.

**Workflow:**

1. Make your changes
2. Run `pnpm changeset` — select affected packages and bump type (patch/minor/major)
3. Commit the generated `.changeset/*.md` file alongside your code changes
4. When ready to release: `pnpm run version` — applies all pending changesets, bumps `package.json` versions, generates per-package changelogs, and syncs non-standard manifests (`plugin.json`, `marketplace.json`, `openclaw.plugin.json`)
5. Commit the version bumps and changelog updates

**Non-standard manifest sync:** Changesets only knows about `package.json` files. The `pnpm run version` script automatically runs `scripts/sync-manifests.mjs` after `changeset version` to propagate versions to `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and `packages/openclaw/openclaw.plugin.json`.

**Pre-push hook:** A `changeset-check` pre-push hook warns when the branch contains changes to shipped artifacts (source code, threat definitions, trusted-domains, hooks, skills, plugin manifests) without a corresponding changeset. Bypass with `git push --no-verify`.

**Building the extension:** To package VSIX files:

```bash
pnpm -C packages/extension run package:cursor:vsix   # Cursor
pnpm -C packages/extension run package:vscode:vsix  # VS Code
pnpm -C packages/extension run package:vsix         # Both
```

---

## Threat Rules

Sage uses YAML-based threat definitions to match tool call artifacts against known dangerous patterns. All detection logic is data — no patterns are hardcoded.

### Rule Files

Rules ship in the `threats/` directory at the repository root:

| File | Scope |
|------|-------|
| `commands.yaml` | Dangerous command patterns (pipe-to-shell, reverse shells, destructive ops) |
| `urls.yaml` | Malicious URL and domain patterns |
| `files.yaml` | Sensitive file path writes |
| `credentials.yaml` | Credential exposure patterns |
| `persistence.yaml` | Persistence mechanisms (cron, systemd, shell RC, LaunchAgents) |
| `obfuscation.yaml` | Encoding and obfuscation techniques |
| `supply_chain.yaml` | Supply chain risk patterns |
| `self-defense.yaml` | Attempts to disable or bypass Sage |
| `agent-layer.yaml` | Agent-protocol threats (prompt injection, MCP tool poisoning, skill-package compromise, context exfiltration) |
| `mitre.yaml` | MITRE ATT&CK technique mappings |
| `win-*.yaml` | Windows-specific variants of the above |
| `mac-*.yaml` | macOS-specific variants (osascript, Keychain, LOLBins, defense evasion) |

### Rule Schema

```yaml
- id: "CLT-CMD-001"
  category: tool
  severity: critical
  confidence: 0.95
  pattern: "curl\\s[^|]*\\|\\s*(bash|sh|zsh|ksh|dash)"
  match_on: command
  title: "Remote code execution via curl pipe to shell"
  expires_at: null
  revoked: false
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (e.g. `CLT-CMD-001`) |
| `category` | string | Threat category — see canonical values below |
| `severity` | enum | `critical`, `warning`, or `info` |
| `confidence` | float | 0.0–1.0, used with sensitivity thresholds to determine verdict |
| `pattern` | string | Regex pattern |
| `match_on` | string or list | `command`, `url`, `file_path`, `content`, or `domain` |
| `title` | string | Human-readable description |
| `expires_at` | string or null | ISO 8601 expiration date, or `null` for permanent |
| `revoked` | boolean | Set `true` to disable a rule without removing it |
| `flags` | string[] | *(optional)* Behavioral flags. Supported: `"report"` (send signal to backend) |
| `case_insensitive` | boolean | *(optional)* Match pattern case-insensitively (default: `false`) |

**Canonical category values:**

| Category | Description |
|----------|-------------|
| `tool` | Dangerous tool or command usage |
| `network_egress` | Outbound connections to suspicious destinations |
| `secrets` | Credential or key exposure |
| `supply_chain` | Package or dependency compromise |
| `prompt_injection` | Instruction-override attacks via external content |
| `mcp_poisoning` | MCP tool-description hijacking or path traversal |
| `skill_compromise` | Malicious content in SKILL.md or plugin manifests |
| `context_exfiltration` | System-prompt or secret leak via agent output |
| `persistence` | Persistence mechanisms (cron, systemd, RC files) |
| `execution` | Remote code execution techniques |
| `defense_evasion` | Obfuscation, bypass, or Sage self-defense attacks |
| MITRE ATT&CK | `command_and_control`, `credential_access`, `discovery`, `exfiltration`, `lateral_movement`, `privilege_escalation`, `reconnaissance` |
| `self_defense` | Attempts to disable or tamper with Sage itself |
| `collection` | Data staging and aggregation before exfiltration |
| `testing` | Canary rules used by E2E tests only |

`match_on` accepts a single value or a list. For example, credential patterns may match on both `command` and `content`:

```yaml
  match_on: [command, content]
```

**Confidence and policy:** Confidence is the sole input to the policy engine. Two thresholds determine the verdict:

| Sensitivity | `deny` threshold | `ask` threshold |
|-------------|-----------------|----------------|
| `paranoid` | 0.70 | 0.30 |
| `balanced` | 0.85 | 0.50 |
| `relaxed` | 0.95 | 0.70 |

A rule with `confidence: 0.95` denies under all presets; one with `confidence: 0.60` asks under paranoid and balanced, allows under relaxed. See [docs/decision-pipeline.md](decision-pipeline.md) for the full policy model.

### What Gets Checked

**Bash commands (cross-platform):**
- Pipe-to-shell attacks, reverse shell patterns (incl. Python/Ruby/zsh socket shells), destructive operations
- Download-and-execute chains, privilege escalation
- Data exfiltration, persistence mechanisms (cron, systemd, shell RC, `at` jobs), credential exposure
- Obfuscation (base64-decode-exec, hex escapes, eval-decode, Python encoded payloads)
- Python one-liners with dangerous imports

**Bash commands (macOS-specific):**
- osascript RCE (AppleScript `do shell script`, JXA execution, piped/remote scripts)
- macOS LOLBins (`dscl`, `networksetup`, `systemsetup`, `kickstart`, `installer`, `hdiutil`, `pkgutil`)
- Keychain attacks (`security find-generic-password`, `dump-keychain`, `unlock-keychain`, `delete-keychain`, direct SQLite access)
- Defense evasion (Gatekeeper disable via `spctl`, SIP disable via `csrutil`, quarantine removal, firewall disable via `pfctl`, TCC reset via `tccutil`, security daemon unloading)
- Privilege escalation (`dscl -passwd`, `dseditgroup` admin group add)
- Destructive operations (`diskutil eraseDisk`, `tmutil delete` — ransomware indicator)
- Persistence (LaunchAgents via `osascript`/`launchctl`, login items, SecurityAgentPlugins, emond rules, `DYLD_INSERT_LIBRARIES`, Folder Actions, periodic scripts)
- Obfuscation (base64-to-osascript, DYLD injection, binary plist conversion via `plutil`, Swift inline execution)
- Supply chain (Homebrew install without version pin, remote `.pkg` install, cask installs)

**File writes/edits:**
- System authentication files, SSH keys and config, shell RC files
- macOS LaunchAgents/LaunchDaemons, TCC.db, authorization DB, kernel extensions, SecurityAgentPlugins, emond rules, Safari credential stores, Managed Preferences, Keychain files
- Cron directories, systemd unit files
- Credential files (`.env`, `.aws/credentials`, `.netrc`)
- Git hooks, URLs and credentials embedded in content

**URLs:**
- Known malware/phishing/scam patterns
- Paste sites used for C2, direct IP address URLs
- Executable file downloads

### Trusted Installer Domains

Pipe-to-shell commands targeting known installer domains are suppressed from heuristic matches. The trusted domains list lives in `trusted-domains/trusted-installer-domains.yaml`:

```yaml
- domain: bun.sh
  reason: Bun JavaScript runtime installer
- domain: brew.sh
  reason: Homebrew package manager installer
```

Domains are matched by suffix with dot boundary (e.g. `bun.sh` matches `cdn.bun.sh` but not `notbun.sh`).

### Licensing

Threat rules are licensed under the [Detection Rule License 1.1](../threats/LICENSE), separate from the Apache 2.0 source code license. See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.

---

**Gen Digital team:** See the sage-internal repo for leak prevention setup, release sync workflows, and pre-release audit instructions.
