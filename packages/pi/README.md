# Sage for pi

Sage integrates with [pi](https://pi.dev) (verified against `@earendil-works/pi-coding-agent` 1.0.4)
as an extension and evaluates tool calls before they run. It registers against pi's `tool_call`
event and blocks a call by returning `{ block: true, reason }`; pi hands the reason back to the
model as the tool result.

## What it protects

| Category | pi tools | Canonical label |
|---|---|---|
| Command execution | `bash`, `powershell` (`command`) | `Bash` |
| Filesystem writes | `write` (`path`, `content`), `edit` (`path`, `edits[].oldText/newText`) | `Write` / `Edit` |
| Filesystem reads  | `read` (`path`) | `Read` |

pi's `edit` is exact-text replacement only (no hashline mode). Handlers receive arguments after
pi's `prepareArguments`, so legacy single-edit and stringified `edits` payloads arrive normalized.
Tools invoked from codemode scripts fire their own `tool_call` events and are evaluated
individually. Search/listing tools (`grep`, `find`, `ls`) and MCP tools emit no artifacts;
sage's evaluator short-circuits to allow.

## Install

```bash
git clone https://github.com/gendigitalinc/sage
cd sage
pnpm install
pnpm --filter @gendigital/sage-pi run build
pi install /path/to/sage/packages/pi      # persistent, via the package's `pi.extensions` manifest
pi -e /path/to/sage/packages/pi/dist/index.cjs   # or for a single run
```

## Behavior

- **allow** verdicts: pass through
- **deny** verdicts: block with `{ block: true, reason }`; the footer status banner stays up until
  the next call
- **ask** verdicts: with a dialog-capable UI (TUI, RPC) prompt via `ctx.ui.confirm`; confirmed
  approvals persist for 10 minutes so identical retries skip the prompt. Without a UI (`-p`,
  JSON mode) ask verdicts block.

The verdict mapping and its error boundaries are shared with the Oh My Pi connector
(`createHookToolCallHandler` in `packages/core/src/hook-tool-call-handler.ts`): sage's own
failures fail open, UI failures never downgrade a verdict.

Diagnostics go to sage's operational log (`operational_logging` in `~/.sage/config.json`); pi's
extension API has no logger.

## Build

```bash
pnpm --filter @gendigital/sage-pi run build
```

Copies `threats/` and `trusted-domains/` into `packages/pi/resources/` and bundles `src/index.ts`
with esbuild into a single CommonJS file, `dist/index.cjs`. pi runs extensions on Node, which
cannot load sage-core's ESM `dist` directly.

## Test

```bash
pnpm --filter @gendigital/sage-pi test
```
