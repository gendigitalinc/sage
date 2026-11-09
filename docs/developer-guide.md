# Developer Guide

Reference for contributors. Covers the monorepo architecture, development workflow, and threat rule format.

---

## Architecture

Sage is a TypeScript monorepo with a shared core library and platform-specific connectors.

### Packages

```
packages/
├── core/          @gendigital/sage-core         Platform-agnostic detection engine
├── hook-host/     @gendigital/sage-hook-host     Shared handler for pi/omp-style hosts ONLY (confirm/setStatus UI); NOT a generic hook layer — OpenClaw/OpenCode have different result shapes and call guardToolCall directly
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
| `config-defaults.ts` | Default config serializer and `~/.sage/config.defaults.json` deployment |
| `cache.ts` | JSON file verdict cache with TTLs |
| `audit-log.ts` | JSONL audit logging |
| `detection-names.ts` | Stable canonical names for Sage-owned detection signals |
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

Session start deploys `ConfigSchema`'s portable defaults to `~/.sage/config.defaults.json` for GUI tools. Bump `CONFIG_DEFAULTS_SCHEMA_VERSION` whenever that serialized defaults payload changes, including added or removed fields, type changes, and default-value changes. The version establishes deployment precedence between concurrently installed Sage versions; it is not only a JSON compatibility marker.

### Connector Architecture

Pick the template by how the host delivers tool calls, not by the product name.

| Host API style | Connector | Pattern |
| --- | --- | --- |
| MCP hook tools (separate process per hook) | Claude Code | `mcp-hook-tools.ts` — normalize, guard, return JSON |
| In-process plugin event (`before_tool_call`) | OpenClaw, OpenCode | Connector-owned `tool-handler.ts` + `guardToolCall` |
| In-process `tool_call` / `tool_result` hooks | pi, Oh My Pi (omp) | `@gendigital/sage-hook-host` (`packages/hook-host`), plus a thin adapter. Not part of sage-core's public API. |
| Editor hook installer (out-of-process hook script) | Cursor, VS Code, Copilot CLI | `packages/extension` installs a hook that calls the same core evaluator |

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
| **pre-commit** | private key detection, lint | Fast |
| **pre-push** | build, typecheck, test, changeset check | Slow (fails fast) |

### Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages (tsc + esbuild) |
| `pnpm test` | Run unit + integration tests (builds automatically) |
| `pnpm test -- --reporter=verbose` | Verbose test output |
| `pnpm test -- <file>` | Run a single test file |
| `pnpm test -- -t "name"` | Run tests matching name |
| `e2e/run.sh <agent>` | Containerized live E2E (Layer 2) for one agent: `claude`, `copilot`, `opencode`, `cursor`, `openclaw`, `vscode` (or `all`). Builds the pinned agent image, then runs the suite in container mode. Requires Docker + `e2e/.env`. pi and omp are not in this harness yet: their drift capture is wired (`captureHookInput` with `pi-` / `omp-` prefixes) but there is no `agents.json` entry, image, or native runner. **Tracked gap:** the pi/omp READMEs claim verification against specific host versions (pi 1.3.0, OMP 18.12), but no Layer 2 drift detection enforces this yet. Wire an `agents.json` entry + image (or native runner) for pi and omp so host-version drift is caught before these connectors ship widely. |
| `pnpm test:e2e:cursor` / `:vscode` | Desktop Extension Host suite (Layer 3) against an installed Cursor / VS Code binary. The other `test:e2e:*` scripts are the in-container entry points invoked by `e2e/run.sh` and skip outside container mode. |
| `pnpm build:sea` | Build standalone SEA binaries |
| `pnpm lint` | Lint with Biome |
| `pnpm lint:fix` | Lint + auto-fix |
| `pnpm check` | Type check all packages |
| `pnpm changeset` | Create a changeset for your changes |
| `pnpm run version` | Apply changesets: bump versions, generate changelogs, sync manifests |
| `pnpm eval:pi` | PI accuracy benchmark (requires model at `~/.sage/models/<schema>/pi-model/`) |

### E2E architecture

The end-to-end tests are split into layers because a single live test was doing two
unrelated jobs at once — **detection** ("does Sage block canary `diagmark_cmd_…`?") and
**host wiring** ("does the host actually fire our hook with the expected payload and honor
our verdict?") — and paying for a real LLM + binary + network to re-prove detection we can
prove deterministically. Detection is verified without any of that; the live layer is
reserved for the wiring only it can prove, plus drift.

**Drift is a first-class requirement, not a side effect.** Freezing the host contract into a
committed fixture trades flakiness for *staleness*: the connector moves on, the fixture stays
green, and we learn about the break from user bug reports. So the fixture must be continuously
re-validated against the real host, and divergence must be a loud failure.

**Three layers, each with one job:**

- **Layer 1 — contract (deterministic, every PR, zero setup).** Feed each connector the exact
  payload a host sends and assert the verdict / response shape. Covers the bulk of detection +
  the host I/O contract, plus connector behaviors (extra-tool registration, prompt injection)
  and the **tool-name maps**. No binaries, keys, or network; runs in `pnpm test`.
- **Layer 2 — live E2E (containerized, scheduled, real agents + Sage).** Run the real agents
  with Sage inside per-agent containers to (1) verify wiring — the only thing a contract test
  can't — and (2) re-validate the Layer 1 fixtures against the real host, **failing on diff**
  (never auto-committing; a real host change opens a PR for human review). See `e2e/README.md`
  for the harness, per-agent specifics, and the routing model. For claude/opencode/cursor/
  copilot, the same wiring assertions also run **natively** (`SAGE_E2E_RUNNER=native`, no
  Docker) against an already-installed, already-authenticated CLI — a convenience mode for
  local iteration and platforms without Docker (e.g. bare Windows); it does not re-validate
  drift/tool-catalog fixtures, and it isn't a CI gate. openclaw stays container-only (it's a
  gateway image, not a standalone binary).
- **Layer 3 — desktop GUI (macOS / Windows).** The Cursor/VS Code desktop paths (keychain,
  `Cursor.app`, `Code.exe`) can't run in a Linux container; they run the Extension Host
  against an installed binary. Real VS Code Copilot **Chat** drift validation also lives here
  by necessity — headless Chat can't authenticate (interactive GitHub sign-in + entitlement),
  so it never loads in a container. Native-agent coverage is not yet in place.

**Tool-name drift** is a distinct hazard: an agent renames a tool (`Read`→`read`), drops one,
or adds one, and the connector's name→canonical map silently stops matching — Sage goes blind
for that tool. The map keys are Sage's tool-name dependency surface, so they're **pinned in a
Layer 1 snapshot** (`tool-names-contract.test.ts` per connector) and **verified live in Layer
2**; where a host exposes a model-free tool catalog (e.g. Claude Code's `system/init`), Layer 2
diffs advertised names vs the pinned set deterministically. Rule: "model didn't invoke the
tool" is *inconclusive, never a pass*.

**Settled decisions:** per-agent images on a shared base image; **Sage is bind-mounted at
runtime, never baked in** (so the current branch — even uncommitted — is what runs); agent
versions are **pinned in `agents.json`**, updates auto-proposed via PR; one run mode param
`SAGE_E2E_MODE=pinned|latest` (`pinned` = build at the pinned version, the PR gate; `latest` =
resolve newest stable host-side, build at it, diff, and route); model-driven agents
authenticate via **Vertex ADC** (no API keys). The weekly `latest` job runs every agent and
routes each result through `classifyDrift` (`packages/core/src/e2e-drift-routing.ts`):
clean version bump → auto-merging PR, payload/code drift → review PR, reproduced red / build
failure → alarm. The routing table is unit-tested per row.

### Test Tiers

E2E is organized in two layers (a third, desktop-GUI layer, is partly in place; see below).
**Layer 1** proves detection + the host I/O contract deterministically, with no binaries,
keys, or network — it runs in `pnpm test`. **Layer 2** runs the *real* agents with Sage
inside containers to prove the live wiring (the host fires our hook and honors the verdict)
and to re-validate the Layer 1 fixtures against the real host (fail on drift). Detection
logic is **not** re-asserted live — Layer 2's job is wiring + drift, not re-proving Layer 1.

| Tier | Scope | Files | Requires |
|------|-------|-------|----------|
| Unit | Core library | `packages/core/src/__tests__/*.test.ts` | dev deps only |
| Layer 1 — Contract / integration | Detection + host I/O contract + tool-name maps + connector behaviors (registration, prompt injection), all via mock API | `packages/claude-code/src/__tests__/` (incl. `integration.test.ts`, `*contract*.test.ts`), `packages/openclaw/src/__tests__/e2e-integration.test.ts`, `packages/opencode/src/__tests__/integration.test.ts`, `packages/extension/src/__tests__/integration.test.ts` + `tool-names-contract.test.ts` | dev deps only |
| Layer 2 — Containerized live E2E | Real agent + Sage in Docker; canary-deny wiring + payload/tool-name drift | `packages/{claude-code,openclaw,opencode}/src/__tests__/e2e.test.ts`, `packages/extension/src/__tests__/e2e-copilot-cli.test.ts`, the Cursor-headless + VS Code-container blocks of `packages/extension/src/__tests__/e2e.test.ts` | Docker + `e2e/.env`; run via `e2e/run.sh <agent>` |
| Layer 2 — Native live E2E | Same canary-deny wiring assertions, no Docker; drift/tool-catalog checks stay container-only | Same files as above, minus `openclaw` (container-only) | An installed, already-authenticated CLI (claude, opencode, cursor-agent, or copilot); run via `SAGE_E2E_RUNNER=native pnpm test:e2e:<agent>` |
| Layer 3 — Desktop GUI | Sage extension in an installed Cursor / VS Code Extension Host (keychain, executable discovery) | Block A of `packages/extension/src/__tests__/e2e.test.ts` | Installed Cursor / VS Code binary; run via `pnpm test:e2e:cursor` / `:vscode` |

`pnpm test` runs unit + Layer 1 (integration). Layer 2 is excluded — run with `e2e/run.sh
<agent>` (containerized) or, for claude/opencode/cursor/copilot, natively via
`SAGE_E2E_RUNNER=native pnpm test:e2e:<agent>` (no Docker; openclaw has no native path — it's
a gateway image, not a standalone binary). Both modes are gated on `SAGE_E2E_RUNNER`
(`container` or `native`) and skip otherwise. Native mode reuses whatever auth the installed
CLI already has (no `e2e/.env`/Vertex needed), isolates to a temp HOME, and is scoped to the
wiring assertions — not the drift/tool-catalog checks, which remain container-only. See
`e2e/README.md`'s "Run natively" section for prerequisites and Windows notes. The desktop
Extension Host suite (Layer 3) still runs against an installed binary and is partly covered
in Layer 2 for VS Code (wiring-only, under Xvfb); Cursor's Extension Host has no container
equivalent. Native macOS/Windows *desktop GUI* coverage is not yet in place (distinct from the
Layer 2 native CLI mode above).

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

E2E tests use dummy canary rules (`threats/dummy.yaml`) instead of real threat patterns. The canary rules match harmless, highly-specific marker strings (e.g. `diagmark_cmd_a75bf229`) that would never appear in real usage. The markers are deliberately **opaque** — they carry no "this is a security test" cue in the payload itself (the rule `id`/`title` hold the human-readable meaning). A self-describing token like `__sage_test_deny_cmd_…` reads as a security probe, and a safety-trained model that has been given security context — notably OpenCode, whose connector injects Sage's session-scan findings into the prompt — will refuse to run it, so the artifact never reaches Sage and the deny/ask test can't fire. Opaque markers run as rote yet stay unique, so false positives remain essentially impossible. The same set is shared by every agent's E2E suite and is included in all distribution packages alongside real threat definitions.

### E2E Setup

#### Layer 2 — containerized live E2E

All six agents (claude, copilot, opencode, cursor, openclaw, vscode) run the same way: a
per-agent image built on a shared base, with current-branch Sage **bind-mounted** at runtime
(never baked in), driven via `docker compose`. The harness lives under `e2e/` — see
`e2e/README.md` for the full reference (`run.sh`, `compose.yml`, `agents.json`, the resolver,
and the drift-routing model). The test logic (parsing, assertions, JUnit) runs on the host;
the container is only the agent sandbox.

```bash
pnpm build                 # globalSetup also builds, but build once up front
e2e/run.sh claude          # one agent
e2e/run.sh all             # every agent
```

**Prerequisites:** Docker + a populated `e2e/.env` (copy `e2e/.env.example`). The suites are
gated on `SAGE_E2E_RUNNER=container` (set by `run.sh`); running `pnpm test:e2e:*` directly
without it skips. Auth per agent, injected via `e2e/.env`:

| Agent(s) | Auth | Notes |
|----------|------|-------|
| claude, opencode, openclaw | **Vertex ADC** (no API key) | `CLAUDE_CODE_USE_VERTEX=1` + project/region; ADC from the GCE metadata server (CI) or a mounted ADC file locally. openclaw reaches Gemini via the same Vertex project. **No `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`.** |
| copilot | GitHub token (`GITHUB_TOKEN`) | Copilot-entitled token |
| cursor | `CURSOR_API_KEY` | Cursor's own backend (no Vertex) |
| vscode | none | wiring-only suite under Xvfb; no model/auth |

Model overrides (optional): `SAGE_E2E_MODEL` (claude), `OPENCODE_E2E_MODEL`,
`COPILOT_E2E_MODEL`, `OPENCLAW_E2E_MODEL`, `SAGE_HEADLESS_AGENT_MODEL` (cursor).

OpenClaw is the one cross-repo case: it is **not** built on our base — the suite consumes the
official OpenClaw image (`OPENCLAW_IMAGE`, kept in the gitignored `e2e/.env`)
and owns the gateway lifecycle itself (`compose up -d` → poll `/health` → drive over HTTP →
`down`). No `~/.openclaw/openclaw.json` setup is needed; the container entrypoint enables the
chat-completions endpoint and sets the token.

#### Layer 2 — native live E2E (no Docker)

The same claude/opencode/cursor/copilot suites also run directly against an already-installed
binary — no Docker, no `e2e/.env`. Useful for fast local iteration or a machine without
Docker/WSL2 (e.g. bare Windows). openclaw has no native path — it's a gateway image, not a
standalone binary — and stays container-only.

```bash
SAGE_E2E_RUNNER=native pnpm test:e2e:claude
SAGE_E2E_RUNNER=native pnpm test:e2e:opencode
SAGE_E2E_RUNNER=native pnpm test:e2e:cursor
SAGE_E2E_RUNNER=native pnpm test:e2e:copilot-cli
```

**Prerequisites:** the corresponding CLI installed and already authenticated exactly as you'd
normally use it — no separate auth setup. Each suite resolves the binary from PATH (or an env
override — `SAGE_CLAUDE_PATH`, `SAGE_OPENCODE_PATH`/`OPENCODE_E2E_BIN`,
`SAGE_CURSOR_AGENT_PATH`/`SAGE_AGENT_PATH`, `SAGE_COPILOT_PATH`) and skips cleanly with a
`console.warn` if it isn't found — never a hard failure.

**Isolation + auth:** every native run is isolated to a fresh temp `HOME` (never your real
`~/.sage`, `~/.cursor`, or `~/.copilot`) while still reusing your ambient login — each
connector copies forward only the specific auth file it needs (opencode's
`~/.config/opencode/model.json`, copilot's `~/.copilot/config.json`) rather than the whole
real `HOME`. Cursor and copilot also always symlink the real `~/Library` into the isolated
HOME on macOS, regardless of any env-var key — both touch the keychain unconditionally
(cursor for its own session bookkeeping; copilot to resolve the token behind the copied
config's logged-in-user reference). Without `~/Library`, cursor pops a "Keychain Not Found"
dialog, and copilot falls back to inferring the GitHub host from the current repo's git
remote — which fails outright if that remote is an internal GHE mirror rather than
github.com (confirmed on an internally-mirrored repo). **claude is the exception**: if
`~/.claude/.credentials.json` doesn't exist (keychain-based auth, common on macOS), the suite
falls back to running against your **real** `~/.claude` instead of an isolated one — a
keychain session can't be relocated to a temp HOME. Prefer env-var auth (`ANTHROPIC_API_KEY`,
Vertex, or your usual corporate proxy vars) if you want full isolation.

**Known limitation (confirmed on a managed install):** if `claude` already has Sage installed
from the plugin marketplace **and** enterprise/managed settings pin the plugin list, Claude
Code silently ignores `--plugin-dir` and loads the cached marketplace version instead of your
current branch — a Claude Code policy decision, not something Sage can work around. The native
claude suite detects this (`plugin_errors` on `system/init`) and fails loudly with an explicit
message instead of silently testing the wrong plugin version. Container mode is unaffected (no
pre-installed marketplace plugin in the image to conflict with).

**Scope + Windows:** native mode restores only the original wiring assertions (benign-allow +
canary-deny) — the drift-diff and tool-catalog-drift checks stay container-only, since the
capture sink they read from is never wired up outside a container. No version pinning either
(unlike the Docker images, native mode runs whatever version you have installed). This is also
the **first Windows-facing E2E code path in this project** — no Windows E2E CI has ever
existed for any layer (including the GUI Layer 3 above), so treat it as newer/less
battle-tested than the container path and verify locally on Windows before relying on it there.

#### Layer 3 — desktop Extension Host (Cursor / VS Code)

Block A of `packages/extension/src/__tests__/e2e.test.ts` drives the Sage extension inside an
installed Cursor / VS Code Extension Host (keychain, executable discovery) — the desktop path
that can't run headless in a Linux container. It runs against a locally-installed binary and
skips where none is found. VS Code additionally has a wiring-only Layer 2 container path (under
Xvfb). Native macOS/Windows agents for the full desktop matrix are not yet in place.

**Run:** `pnpm test:e2e:cursor` / `pnpm test:e2e:vscode` (extension built by Vitest `globalSetup`).

**Optional executable overrides:**

| Variable | Description |
|----------|-------------|
| `SAGE_CURSOR_PATH` | Absolute path to the Cursor executable |
| `SAGE_VSCODE_PATH` | Absolute path to the VS Code executable |
| `VSCODE_EXECUTABLE_PATH` | Alternate VS Code executable override |

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
| `_macros.yaml` | Shared pattern vocabulary, not rules — see below |

### Shared Pattern Vocabulary

Several fragments are needed by many rules: the anchor meaning "this program is being executed", the list of shell interpreters, the guard that stops `foo` matching `foo.py`. Copied between rules they drift apart, so `threats/_macros.yaml` holds them once.

A rule references a macro as `{{NAME}}` anywhere in `pattern`, and `threat-loader.ts` substitutes it before compiling:

```yaml
  pattern: "{{CMD_POS}}shred{{NOT_FILENAME}}{{HAS_ARG}}"
```

#### What is available

| Macro | Stands for | Reach for it when |
|---|---|---|
| `{{CMD_POS}}` | everything left of a program name: boundary, dispatch context, wrapper prefix, path | the rule means "this program is being run" — see [Writing Command-Position Patterns](#writing-command-position-patterns) |
| `{{NOT_FILENAME}}` | trailing guard, `(?![-\w.])` | directly after a program name, so `shred` does not also match `shred.py` or `shred-probe` |
| `{{HAS_ARG}}` | lookahead requiring one argument | a bare mention of the program must not fire. The cost is missing an invocation with no arguments |
| `{{SHELLS}}` | the interpreter alternation — `bash`, `sh`, `zsh`, `dash`, `ksh`, `ash`, `busybox`, `powershell`, `pwsh` | the rule concerns a shell taking a command payload |
| `{{CMD_PREFIX}}` | wrapper commands, their flags, `--`, `VAR=value` assignments | building block of `{{CMD_POS}}`; rarely wanted on its own |
| `{{DISPATCH_CTX}}` | `find … -exec`, a shell `-c` payload, a `cmd /c` payload, an `ssh host "…"` payload | building block of `{{CMD_POS}}`; rarely wanted on its own |
| `{{NOT_COMPOUND_LEFT}}` / `{{NOT_COMPOUND_RIGHT}}` | symmetric guard, `(?<![-\w])` / `(?![-\w])` | the identifier appears only as an argument value (a WMI class name), never as a program name, so `{{CMD_POS}}` doesn't apply — but it must still not match inside a longer identifier or hyphenated compound |
| `{{NOT_AFTER_TEXT_CMD}}` | backward-looking denylist guard | an argument-position identifier (see above) also needs to not fire on a quoted mention (`grep -rn "…"`, `echo "… is a classic technique"`) — see [When `{{CMD_POS}}` doesn't apply](#when-cmd_pos-doesnt-apply) |

#### Loader behaviour

| Situation | Result |
|---|---|
| A macro references another macro | Resolved until no references remain, up to five passes |
| A rule references an undefined or over-nested macro | Rule skipped with a warning, as with an uncompilable pattern |
| A mapping in any file other than `_macros.yaml` | Treated as a rule file missing its list: skipped with a warning, not read as vocabulary |
| A rule list inside `_macros.yaml` | Skipped with a warning; the reserved file must be a mapping |
| A rule loads successfully | `Threat.pattern` holds the *expanded* regex, so audit entries and false-positive reports show what actually ran |

Add a macro whenever a second rule would otherwise copy a fragment.

### Rule Schema

```yaml
- id: "CLT-CMD-001"
  version: 1
  detection_name: "CMD:SageCommand-A [Heur]"
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
| `version` | positive integer | Authored rule revision. Increment it whenever the rule's detection semantics change. |
| `detection_name` | string | Stable canonical analytics identity in `Prefix:Family-Variant [Postfix]` form. |
| `category` | string | Threat category — see canonical values below |
| `severity` | enum | `critical`, `warning`, or `info` |
| `confidence` | float | 0.0–1.0, used with sensitivity thresholds to determine verdict |
| `pattern` | string | Regex pattern |
| `match_on` | string or list | `command`, `url`, `file_path`, `content`, or `domain` |
| `title` | string | Human-readable description |
| `expires_at` | string or null | ISO 8601 expiration date, or `null` for permanent |
| `revoked` | boolean | Set `true` to disable a rule without removing it |
| `flags` | string[] | *(optional)* Behavioral flags. Supported: `"submit_only"` (never affects the verdict; sends capped non-blocking telemetry to `/v2/heuristic`, max 1 submit/rule/client/24h — see [decision-pipeline.md](decision-pipeline.md#flags)). Unknown flags are ignored. |
| `case_insensitive` | boolean | *(optional)* Match pattern case-insensitively (default: `false`) |

`id`, `version`, and the YAML-authored `detection_name` are separate metadata contracts. The immutable `id` is the engineering identity, `version` tracks authored rule revisions, and the authored name is the stable canonical identity shown on user-facing surfaces. A version bump must never change the authored detection name; create a new rule identity if the detection concept itself changes. Do not put changing values such as rule versions, package coordinates, model IDs, scores, or AMSI result codes into YAML.

When Sage writes audit signals or sends telemetry/false-positive reports, it derives a reporting name in the form `<canonical name>|<engine shorthand>:<optional data>|sage`. Heuristics use `sghe:<rule id>:<rule version>`, package checks use `sgpk:<package name>[:<version>]`, prompt-injection ML uses `sgml:<model id>:<model schema>` (hits instead use the online-classifier form `Text:OnlineClassifier [Misc]|<model version>-<text hash>|sgpi`), and AMSI uses `sgam:<AMSI rule name>:<amsi result hex>`. AMSI rule names are `AMSI_DETECTED`, `AMSI_BLOCKED_BY_ADMIN`, or `AMSI_UNKNOWN`; the value is lowercase hexadecimal without a `0x` prefix (for example, `sgam:AMSI_DETECTED:8000` for result `0x8000`). Every reporting name ends in `|sage`, except online-classifier hits, which end in their technology tag (`|sgpi`). Keep these reporting suffixes out of YAML and user notifications.

Rule authors must increment `version` manually when changing a pattern, confidence, severity, match target, category, or other behavior that can change matching or verdicts. Documentation-only edits do not require a bump. Automatic version-bump enforcement is deferred; review the version explicitly with every rule change.

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

### Writing Command-Position Patterns

A rule with `match_on: command` receives the entire command string. There is no shell parsing and no notion of `argv[0]`, so nothing in the input distinguishes a program being executed from its name appearing in an argument, a path, or a quoted string. A rule meaning "this program is being run" has to say so in the regex.

Do not write that anchor per rule — use `{{CMD_POS}}`:

```yaml
  pattern: "{{CMD_POS}}shred{{NOT_FILENAME}}{{HAS_ARG}}"
```

#### Anatomy

`{{CMD_POS}}` covers items 1–5; the rule supplies 6 and 7. `CLT-CMD-009` is the reference implementation.

```
  ls;  sudo -u root  bash -c "  env FOO=1  /usr/bin/  shred  -u f"
  (1)  (2)           (3)        (4)        (5)        (6)    (7)
```

| | Part | Matches |
|---|---|---|
| 1 | command boundary | `^`, `;`, `&`, <code>&#124;</code>, `(`, newline, backtick |
| 2 | wrapper prefix | `sudo`, `doas`, `env`, `nohup`, `time`, `xargs`, `wsl` — with their flags, `--` and `VAR=value`. Optional |
| 3 | dispatch context | `find … -exec`, a shell `-c` payload, `cmd /c`, `ssh host "…"`. Optional |
| 4 | wrapper prefix again | the dispatched payload is a fresh command line, so the same tokens may precede its program |
| 5 | path prefix | `/usr/bin/`. Optional |
| 6 | the program name | supplied by the rule, followed by `{{NOT_FILENAME}}` |
| 7 | its arguments | `{{HAS_ARG}}` requires at least one |

Three terms recur below. **Command position** is where a program name may legally appear: after a boundary, or inside a dispatched payload. A **dispatch context** is a point where one command line starts another. A **prefix token** is a word that may precede a program name without changing which word is the program.

#### When `{{CMD_POS}}` doesn't apply

Not needing a path prefix is not by itself a reason to skip `{{CMD_POS}}` — the prefix it allows is optional. A cmdlet occupies command position exactly like a binary does, so it still wants `{{CMD_POS}}foo{{NOT_FILENAME}}`; `CLT-WIN-CMD-036` is the reference implementation.

The real disqualifier is an identifier that legitimately appears as an *argument value*, not a program name — a WMI class name passed as `-Class CommandLineEventConsumer`. `{{CMD_PREFIX}}`'s generic flag-value branch consumes `-Class CommandLineEventConsumer` whole while looking for a next program name, so `{{CMD_POS}}` never gets a chance to anchor on the class name itself; requiring command position here breaks the real detection. These still need a boundary — `\bfoo\b` has the same filename/compound-identifier problem as any other bare pattern — but only the symmetric guard, `{{NOT_COMPOUND_LEFT}}foo{{NOT_COMPOUND_RIGHT}}`. `CLT-WIN-PERSIST-008` is the reference implementation.

That guard alone still lets a quoted mention through — `grep "CommandLineEventConsumer"` — since a search/print command in front of the identifier isn't a boundary the guard can see. `{{NOT_AFTER_TEXT_CMD}}` closes that with a backward-looking denylist of text/search/print commands (`grep`, `awk`, `echo`, `Write-Host`, …); see `_macros.yaml` for the matching mechanism, the denylist rationale, and known gaps. `CLT-WIN-PERSIST-008` combines both guards: `{{NOT_AFTER_TEXT_CMD}}{{NOT_COMPOUND_LEFT}}foo{{NOT_FILENAME}}` (using `{{NOT_FILENAME}}` in place of `{{NOT_COMPOUND_RIGHT}}` also rejects a trailing dot, e.g. `foo.md`). Both guards are zero-width lookbehinds anchored at the same position, so their relative order doesn't affect matching — this order just mirrors the rule file.

#### What it does not match

Deliberate gaps, listed so you can recognise them rather than debug them:

| Not matched | Why |
|---|---|
| `docker run img bash -c "foo …"` | dispatch through a wrapper that is not on the list |
| `/bin/bash -c "foo …"`, `C:\Windows\System32\cmd.exe /c foo` | a dispatcher named by absolute path; only the *program* takes a path prefix, not the dispatcher |
| `su -c "foo …"` | runs a command but is not a shell, so it is not a dispatch context |
| `echo "(shred -u f)"` | `(` and backtick are boundaries unconditionally, so a quoted mention containing one still fires — this one is a false positive, not a miss |
| `cmd /c powershell -Command foo …` | the dispatched payload is itself another dispatch; `{{CMD_POS}}` models one hop, not a chain |
| `bash -c sudo foo …` (unquoted, multiple tokens) | POSIX `-c` takes exactly one argument as the command string — everything after it becomes `$0`, `$1`, ... positional parameters, not executed text, so only `sudo` (with no arguments) actually runs. `{{POSIX_SHELLS}}` therefore requires a quote for multi-token payloads; PowerShell and `cmd` don't, because they rejoin unquoted trailing words into one command line instead. A single trailing token (`bash -c foo`) is exempt — nothing is left over to misattribute, so it's the entire command string either way |

Widen these by adding names, on evidence. Never by relaxing the prefix into free-form text.

#### Constraints when changing the macro

Each of these prevents a specific false positive or evasion.

**A word boundary is not command position.** `\bfoo\b` matches inside filenames (`foo.py`), path segments (`foo-latency-probe`) and quoted prose (`grep -rn "foo"`), because `.`, `-` and `/` are non-word characters.

**A whitespace boundary is not either.** `(^|\s|[;&|])foo` also accepts *argument* position: `man foo | head`, `command -v foo`, `which foo && echo ok`, `cp /tmp/foo /tmp/out`.

**A quote is not a command boundary.** Treating `"` as one makes any text mentioning the command match, including `git commit -m "… sudo foo …"`. Gate quoted payloads on the `-c` flag of a known shell, or an `ssh` argument.

**Anchor every alternative you add**, or it becomes the next false-positive path. A dispatcher counts only when it is itself at command position, so what precedes it must be prefix tokens, never free-form text — otherwise `echo use bash -c "foo -u f"` reads as an invocation. Where a marker is meaningful only under one command, require that command: `-exec` requires a `find`. Test each alternative by asking what the pattern does when the whole command line is `echo <alternative> …`.

**Prefer a miss to a false positive.** The residual risk is asymmetric: a false positive here is unusual prose, while a miss is an evasion, since wrapping in `bash -c "…"` is how an anchored rule gets sidestepped. That asymmetry is why dispatch contexts exist at all.

**Keep every repetition unambiguous.** A loop whose branches can both consume the same token backtracks exponentially:

```
(?:-{1,2}[\w-]+(?:[= ]\S+)?\s+)*    # exponential — 32 flags ≈ 167 ms
```

`-a` parses either as a bare flag or as a flag whose space-separated value is the next flag, and both parses let the loop continue. The fix is to make the branches mutually exclusive, so no single token can match two of them — here, a space-separated flag value may neither start with `-` nor contain `=`:

```
(?:--\s+|--?[\w][\w-]*(?:=\S+|\s[^\s\-=][^\s=]*)?\s+|[A-Za-z_]\w*=\S*\s+)*    # linear — 200 flags ≈ 0.02 ms
```

This matters more than tidiness: patterns are compiled raw in `threat-loader.ts` with no complexity check and matched with a bare `.test()` with no timeout, so a catastrophic pattern hangs the hook rather than failing open.

**Bound character runs, not token loops.** An open-ended character run needs a ceiling (`{0,200}`, not `*`) because it can wander. A loop over mutually exclusive whole tokens is already linear, and capping it creates an evasion instead: inert padding pushes the program past the cap and the rule goes quiet. Bound what protects the engine, never what an attacker controls the length of.

Add a timing fixture for any new repetition — see "matches long argument runs in linear time" in `command-threats.test.ts`.

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
