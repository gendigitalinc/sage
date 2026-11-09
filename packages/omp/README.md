# Sage for Oh My Pi

Sage integrates with [Oh My Pi](https://github.com/can1357/oh-my-pi) (verified against 18.12) as a
hook and evaluates tool calls before they run. It ships as an in-process hook factory registered
against OMP's `tool_call` event; OMP binds it through its extension runner.

## What it protects

| Category | OMP tools | Canonical label |
|---|---|---|
| Command / code execution | `bash` (`command`), `eval` (`code`, JS or Python — also covers the browser prelude), `debug` (launched `program` + `args`, `evaluate` expressions, breakpoint conditions, custom DAP requests) | `Bash` |
| Filesystem writes | `write`, `edit` (every edit mode, see below), `ast_edit` (paths + replacement templates) | `Write` / `Edit` |
| Filesystem reads  | `read` (local path) | `Read` |
| Network           | `read` (http(s)/`www.` URL, including a collapsed `https:/host` scheme) | `WebFetch` |

`edit` is parsed in every `edit.mode` / `PI_EDIT_VARIANT`, so sage works with hashline enabled or
disabled: `hashline` (`[PATH#TAG]` headers, `MV` renames, `+` body rows), `replace`
(`path`/`old_string`/`new_string`), `patch` (`path` + `edits[].rename`/`diff`), `apply_patch`
(`*** Add/Update/Delete File:`, `*** Move to:`), and `sloppy` (`*** Edit File:` with Find/Replace/Insert
sections). The textual modes share one `{ input }` shape and OMP's parsers strip each other's framing
as noise, so sage collects file headers of every grammar (matching OMP's leniency: case, missing
colons, indentation, trailing whitespace, bracketed envelope markers) and always scans the raw patch
text — content is evaluated even when no target path parses. Target paths come from the patch body;
the sibling `path` field is used only when the body names no file, as OMP's hashline parser does.

Package-manifest checking is first-path only. Core's manifest parser reads `toolInput.file_path` (the first rename destination, else the first edited path), not every path artifact. A multi-file edit whose first path is harmless and a later path is `package.json` does not get the package check. Path rules and content heuristics still see every path. The core union fix was reverted from this PR; the follow-up is a core change, not this connector.

## Intentionally unguarded

These OMP tools emit no artifacts, so the evaluator short-circuits to allow. The
covered set above is pinned in
`src/__tests__/fixtures/contract/tool-names.json`; anything not in that fixture
is unguarded on purpose:

| Tool | Why it is unguarded |
|---|---|
| `grep`, `find`, `glob` | Read-only search. They return matching text but do not execute it, write it, or open a network endpoint. A later change that wants them guarded should map them like the pi connector (`Grep` / `Glob`). |
| `ask` | Asks the user a question. No command, file, or URL side effect. |
| `task` | Spawns a subagent. The subagent's own tool calls each fire a `tool_call` event and are evaluated there; guarding the task prompt would double-scan work the child calls already cover. |
| `github` | GitHub API helper. Its effects (push, PR, file change) go through `bash` / `edit` / `write`, which are guarded. The helper itself does not execute local commands. |
| `manage_skill` | Installs or lists skills. Skill contents are not executed at install time; a skill-scanning pass (like the other connectors' plugin scan) is future work, called out below. |
| `vibe_*` | Editor-affordance helpers (selection, cursor, visible range). They read editor state, not files the agent chose, and cannot run code. |
| browser / `fetch` / `computer` | Present in some OMP builds as optional tooling. Not in the guarded set for 18.12: a fetch or computer-use call should be mapped to `WebFetch` / `Bash` before those tools are treated as supported. Until then they pass through. |

`grep`/`find`/`glob` are the deliberate exception to "map it like the other
connectors": OMP's search tools were left unguarded because their payloads are
metadata (a pattern and a root), and the pi connector is the one that now
guards the equivalent tools.

## Install

Clone the repo, build the package, then load the built entry point with OMP's `--hook` flag.

```bash
git clone https://github.com/gendigitalinc/sage
cd sage
pnpm install
pnpm --filter @gendigital/sage-omp... run build
omp --hook /path/to/sage/packages/omp/dist/index.cjs
```

Use the explicit `--hook` path: OMP's native discovery scans
`hooks/pre/*.{ts,js}` / `hooks/post/*.{ts,js}` only, so a `.cjs` file dropped
there is never picked up.

## Behavior

- **allow** verdicts: pass through (`undefined`)
- **deny** verdicts: block immediately with `{ block: true, reason }`; the
  status-line banner stays up until the next call
- **ask** verdicts: when a UI is attached (interactive mode), prompt the user
  via `ctx.ui.confirm(title, message)` and mirror a one-line summary with
  `ctx.ui.setStatus("sage", text)`; when no UI is attached (print/subagent
  mode), block for safety — there's no channel to request consent
- **session scan findings** (risky skills, one-time notices): delivered with
  `ctx.ui.notify(message, "info")`, with a one-line summary mirrored to the
  status line. The status line alone is not enough — the next tool call's
  verdict overwrites it, and the scan has already marked one-time notices as
  shown, so the finding would never be seen again

## Error boundaries

Two layers (see `registerHookHandlers` in `packages/hook-host/src/handler.ts`):

1. Extractor / evaluator failures → fail open. Sage's own bugs or missing
   config never crash the agent.
2. UI failures after a verdict is known → preserve the *enforcement*
   decision. Status-banner errors are swallowed (a flaky status backend can
   neither downgrade a deny nor block an ask before the user is prompted); a
   `confirm` that throws blocks the ask. A declined prompt, a missing UI, and a
   failed dialog each drop the pending approval immediately (so it is not left
   until the stale sweep) and return a distinct reason telling the model not
   to retry or work around the block. A 5-minute unref'd timer sweeps anything
   left behind; it runs for the life of the process (not cleared on
   `session_shutdown`), so long-lived omp sessions keep pruning.

## Build

```bash
pnpm --filter @gendigital/sage-omp... run build
```

Builds core and hook-host, then bundles `src/index.ts` with esbuild into a single
CommonJS file, `dist/index.cjs`. In the monorepo, threats and trusted domains are read
at runtime from the repo root; for a published tarball, `prepack` runs
`scripts/sync-connector-assets.mjs`, which copies them into the package's `resources/`.
A single CJS bundle avoids loading sage-core's ESM dist, which Node rejects. Point
`omp --hook` at `dist/index.cjs`.

## Test

```bash
pnpm --filter @gendigital/sage-omp test
```


## Divergence from sibling connectors

Sage ships four connectors (OpenClaw, OpenCode, pi, OMP). Two points of
asymmetry are deliberate and worth calling out:

### Plugin / skill scan: `agent_start`, not `session_start`

OpenClaw scans installed plugins at `gateway_start`/`session_start`. OpenCode
scans extensions on `session.updated`. Both share core's `runPluginScan` →
`runSessionStart` pipeline (version check / heartbeat, config defaults, model
download, skill upload).

OMP emits `session_start` while loading hooks, before this factory can
subscribe, so the scan runs on `agent_start` instead (`src/session.ts`). That
is what puts omp users on the heartbeat and downloads the PI model. It
discovers loose skills under `~/.omp/agent/skills` and the project; a full
extension/hook directory walk is still not done. Per-tool-call checks remain
the primary line of defense.

### No `sage_approve` tool for non-interactive contexts

OpenCode registers a `sage_approve` tool that the agent can invoke to
programmatically resolve an `ask` verdict. OpenClaw uses OpenClaw's native
`requireApproval` with an `onResolution` callback.

OMP's hook API only exposes event handlers — no tool-registration path — so
there is no equivalent programmatic approval mechanism. Interactive `ask`
verdicts use `ctx.ui.confirm`; non-interactive contexts (print mode,
subagents) **fail closed**: the connector returns `{ block: true }` rather
than auto-allowing. This is safer-by-default but less flexible than the
sibling connectors; the tradeoff is intentional.

Approvals granted via `ctx.ui.confirm` **are** persisted in the shared
`ApprovalStore` for 10 minutes (matching siblings), so agent retries of an
identical tool+input within that window skip the prompt.
