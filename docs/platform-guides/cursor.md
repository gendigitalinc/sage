# Cursor / VS Code

## Installation

### Cursor

The recommended way is to [install](cursor:extension/Gen.sage-cursor) the official extension from the Cursor extension marketplace.

Alternatively, you can build from source:

```bash
pnpm install
pnpm -C packages/extension run package:cursor:vsix
```

This produces `sage-cursor.vsix` in the repo root. Install it via `Extensions > Install from VSIX`.

### VS Code

The recommended way is to [install](vscode:extension/Gen.sage-vscode) the official extension from the VS Code extension marketplace.

Alternatively, you can build from source:

```bash
pnpm install
pnpm -C packages/extension run package:vscode:vsix
```

This produces `sage-vscode.vsix` in the repo root. Install it via `Extensions > Install from VSIX`.

> **Tip:** To build both VSIX packages from source at once, use `pnpm -C packages/extension run package:vsix`.

## Usage

Open the command palette (`Ctrl+Shift+P`) and use:

Sage auto-enables protection (managed hooks) on every startup. Running **Sage: Disable protection until restart** removes hooks for the current session only — they are reinstalled automatically when Cursor or VS Code restarts.

### MCP server

- **Cursor**: Sage enables/disables the `sage` MCP server automatically based on whether protection is enabled.
- **VS Code**: you must start the `sage` MCP server manually using the command palette: `MCP: List Server` → `sage` → `Start server`.

| Command | Description |
| --- | --- |
| `Sage: Enable Protection` | Install managed hooks (and enable the Sage MCP server automatically in Cursor) |
| `Sage: Disable protection until restart` | Remove managed hooks until the next restart (and disable the Sage MCP server automatically in Cursor) |
| `Sage: Open Config` | Open `~/.sage/config.json` |
| `Sage: Open Audit Log` | Open the audit log file |
| `Sage: Show Hook Health` | Display hook status |

## How It Works

The extension installs managed hooks into the Cursor/VS Code agent system. When a tool call is intercepted, the hook spawns `sage-hook.cjs` as a subprocess, which runs the same detection pipeline as the Claude Code connector.

## Scope

The extension supports a configurable scope setting:

- **User** - Hooks apply globally for the current user
- **Workspace** - Hooks apply only to the current workspace

Configure via `sage.cursor.scope` (Cursor) or `sage.vscode.scope` (VS Code) in settings.

## E2E Testing

Extension E2E tests run inside installed IDE hosts (no IDE auto-download):

```bash
pnpm test:e2e:cursor
pnpm test:e2e:vscode
```

Cursor headless agent coverage in `pnpm test:e2e:cursor` additionally requires:

- `agent` CLI in `PATH` (or `SAGE_AGENT_PATH`)
- Valid agent auth (`agent login` or `CURSOR_API_KEY`)

Optional executable overrides:

- `SAGE_CURSOR_PATH` - absolute path to Cursor executable
- `SAGE_AGENT_PATH` - absolute path to the `agent` CLI used by Cursor headless E2E
- `SAGE_VSCODE_PATH` - absolute path to VS Code executable
- `VSCODE_EXECUTABLE_PATH` - alternate VS Code executable override

If the `agent` CLI is missing or unauthenticated, only the Cursor headless agent sub-suite is skipped; other extension host E2E tests continue.
Extension hooks always exit with code `0`. The host reads the JSON response to determine whether to block the tool call.

## Build Details

The extension bundles `threats/` and `allowlists/` from the repo root into `packages/extension/resources/` during build (via `sync-assets.mjs`). These are not checked into git.

See the [Installation](#installation) section above for VSIX packaging commands.
