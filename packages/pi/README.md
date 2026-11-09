# Sage for pi

Sage integrates with [pi](https://pi.dev) (verified against `@earendil-works/pi-coding-agent` 1.3.0)
as an extension and evaluates tool calls before they run. It registers against pi's `tool_call`
event and blocks a call by returning `{ block: true, reason }`; pi hands the reason back to the
model as the tool result.

## What it protects

| Category | pi tools | Canonical label |
|---|---|---|
| Command execution | `bash`, `powershell` (`command`) | `Bash` |
| Filesystem writes | `write` (`path`, `content`), `edit` (`path`, `edits[].oldText/newText`) | `Write` / `Edit` |
| Filesystem reads  | `read` (`path`) | `Read` |
| Search / listing  | `grep` (`pattern`, `path`, `glob`), `find` (`pattern`, `path`), `ls` (`path`) | `Grep` / `Glob` / `List` |
| Web               | `url_context` (`urls` or `url`), `web_search` (`query`) | `WebFetch` / `WebSearch` |

`url_context` emits a URL artifact for every entry, so a deny-listed URL in `urls[]` still blocks. The pre-tool prompt-injection scan in core currently covers the first URL only (`toolInput.url`, which this connector sets to `urls[0]`). A follow-up scans every URL before the call. Until that lands, URLs after the first are checked by reputation and heuristics pre-tool and by the output scan on `tool_result`, not by the PI model pre-tool.

pi's `edit` is exact-text replacement only (no hashline mode). Handlers receive arguments after
pi's `prepareArguments`, so legacy single-edit and stringified `edits` payloads arrive normalized.
An edit is scanned for both the replacement (`newText`) and the anchor text being removed
(`oldText`). That is intentional: the removed text is still content the agent was asked to touch,
and a prompt-injected "clean this up" edit is a common way to smuggle a deny-listed URL past a
scanner that only looks at the result. The cost is that deleting a bad URL is itself blocked;
the user approves that edit (ask) or reports it as a false positive (deny).

Tools invoked from codemode scripts fire their own `tool_call` events and are evaluated
individually. The `codemode` tool itself emits no artifacts — the script runs in a QuickJS
sandbox with no Node, file system, or network access. MCP tools and `gui_targets` likewise emit
none; `gui_act` is scanned only when its action carries text (`set_text`).

The shield is not shown at extension load. pi's `ExtensionAPI` has no `ui` (it is on the event
context), and `setFooter` takes a component factory rather than a string. The status line is set
from the `session_start` handler with `ctx.ui.setStatus("sage", text)`.

## Incorporated from vaclavbelak/pi-sage

This connector combines the shared `@gendigital/sage-hook-host` handler (also used by the Oh My Pi
connector) with the pi-specific features of Václav Belák's
[`pi-sage`](https://github.com/vaclavbelak/pi-sage). This section is the attribution for all of
them; see also the repo `NOTICE`.

| Feature | From | Here |
|---|---|---|
| Path resolution: strip `@`, expand `~`, resolve against `ctx.cwd`, so rules see the path pi will open | `src/tools.ts` (`resolvePiPath`) | `src/extractors.ts` |
| Output scanning on `tool_result` (`evaluateToolOutput`) for `read`, `bash`, and `url_context`, plus the medium-risk prompt-injection warning recorded for a fetched URL | `src/handlers.ts` | `sage-hook-host` `src/tool-result.ts` |
| Note after an approved action, pointing at `~/.sage/exceptions.json` | `src/handlers.ts` | `sage-hook-host` `src/tool-result.ts` |
| Status line with blocked/flagged counts, last reason, and fresh risky-skill findings (`manage_status_line`) | `src/status.ts` | `src/status.ts` |
| Session-start scan of pi's loaded extensions, packages, and skill roots | `src/session.ts` | `src/session.ts` |
| Sage MCP server (`sage_report_false_positive`, `sage_list_audit_entries`) via `pi.registerMcpServer` | `bin/mcp-server.mjs` | `src/mcp-server.ts` |
| Runtime paths and Sage version | `src/runtime.ts` | `src/runtime.ts` |

Adapted rather than copied verbatim: we ship one esbuild CommonJS bundle, so his `shim.ts`
(`require` on Node ESM) is not needed, the MCP server is bundled to `dist/mcp-server.cjs` like the
OpenCode connector's, and paths come from `__dirname`. `tool_call` itself stays on the shared
handler, which adds the 10-minute approval reuse, pending-approval cleanup, and distinct
ask-block reasons. The `tool_result` and session-scan pieces now live in `sage-hook-host` so the
OMP connector gets them too.

## Install

```bash
git clone https://github.com/gendigitalinc/sage
cd sage
pnpm install
pnpm --filter @gendigital/sage-pi... run build
pi install /path/to/sage/packages/pi      # persistent, via the package's `pi.extensions` manifest
pi -e /path/to/sage/packages/pi/dist/index.cjs   # or for a single run
```

## Behavior

- **allow** verdicts: pass through
- **deny** verdicts: block with `{ block: true, reason }`; the status-line banner
  (`ctx.ui.setStatus("sage", text)`) stays up until the next call
- **ask** verdicts: with a dialog-capable UI (TUI, RPC) prompt via
  `ctx.ui.confirm(title, message)`; confirmed approvals persist for 10 minutes so identical
  retries skip the prompt. Without a UI (`-p`, JSON mode) ask verdicts block.
  A decline, a missing UI, and a failed dialog each drop the pending approval
  and return a distinct reason telling the model not to retry or work around
  the block. A 5-minute unref'd timer sweeps anything left behind; it runs for
  the life of the process (not cleared on `session_shutdown`), so long-lived pi
  sessions keep pruning.

The verdict mapping and its error boundaries are shared with the Oh My Pi connector
(`registerHookHandlers` in `packages/hook-host/src/handler.ts`): sage's own
failures fail open, UI failures never downgrade a verdict.

Diagnostics go to sage's operational log (`operational_logging` in `~/.sage/config.json`); pi's
extension API has no logger.

## Build

```bash
pnpm --filter @gendigital/sage-pi... run build
```

Bundles `src/index.ts` and `src/mcp-server.ts` with esbuild into two CommonJS files,
`dist/index.cjs` (the extension) and `dist/mcp-server.cjs` (the Sage MCP server). In the
monorepo, threat definitions and trusted domains are read at runtime from the repo-root
`threats/` and `trusted-domains/`. For a published tarball, `prepack` runs
`scripts/sync-connector-assets.mjs`, which copies those folders into the package's
`resources/`, and `runtime.ts` prefers the bundled `resources/` when present. pi runs
extensions on Node, which cannot load sage-core's ESM `dist` directly, hence the CJS bundle.

## Test

```bash
pnpm --filter @gendigital/sage-pi test
```
