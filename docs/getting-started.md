# Getting Started

Sage supports four platforms: Claude Code, Cursor/VS Code, OpenClaw, and OpenCode. Pick the one you use.

## Prerequisites

- **Node.js >= 18** (for Claude Code and OpenClaw; not required for Cursor/VS Code)
- **pnpm** (for building from source)

## Claude Code

Install from the Sage marketplace:

```
/plugin marketplace add https://github.com/gendigitalinc/sage.git
/plugin install sage@sage
```

Restart Claude Code. Sage loads automatically on every session.

## Cursor

Build the VSIX package and install it manually:

```bash
pnpm install
pnpm -C packages/extension run package:cursor:vsix
```

Install the resulting `sage-cursor.vsix` via the Extensions panel (`Extensions > Install from VSIX`). Then run `Sage: Enable Protection` from the command palette (`Ctrl+Shift+P`).

## VS Code

Build the VSIX package and install it manually:

```bash
pnpm install
pnpm -C packages/extension run package:vscode:vsix
```

Install the resulting `sage-vscode.vsix` via the Extensions panel. Then enable protection from the command palette.

To use Sage’s MCP tools in VS Code, start the MCP server manually via the command palette: `MCP: List Server` → `sage` → `Start server`.

> **Tip:** To build both VSIX packages at once, use `pnpm -C packages/extension run package:vsix`.

## OpenClaw

Install from npm or build from source:

```bash
# From npm (recommended)
openclaw plugins install @gendigital/sage-openclaw

# From source
pnpm install && pnpm build
cp -r packages/openclaw sage
openclaw plugins install ./sage
```

The `build` script copies threat definitions and allowlists into `resources/` automatically.

> **Note:** OpenClaw's `plugins.code_safety` audit will flag Sage with a `potential-exfiltration` warning. This is a false positive - Sage reads local files (config, cache, YAML threats) and separately sends URLs to a reputation API. No file content is sent over the network.

## OpenCode

Add the plugin to your OpenCode config:

Global config (`~/.config/opencode/opencode.json`):

```json
{
  "plugin": ["@gendigital/sage-opencode"]
}
```

Or install from source:

```bash
git clone https://github.com/gendigitalinc/sage
cd sage
pnpm install && pnpm --filter @gendigital/sage-opencode run build
# Then use local path in config: "/absolute/path/to/sage/packages/opencode"
```

See [Platform Guide: OpenCode](platform-guides/opencode.md) for tool mapping and verdict behavior.

## Verify It Works

Once installed, ask your AI agent to run this harmless canary command:

```bash
echo __sage_test_deny_cmd_a75bf229__
```

Sage should block it. The marker string matches rule `DUMMY-CMD-DENY-001` from [`threats/dummy.yaml`](https://github.com/gendigitalinc/sage/blob/main/threats/dummy.yaml) — a set of canary patterns shipped with every connector that cover all decision types (deny / ask / log) and artifact types (commands, file paths, content, URLs, domains). Use them to sanity-check each detection layer.

For next steps — handling alerts, managing false positives, adjusting sensitivity — see the [User Guide](user-guide.md).
