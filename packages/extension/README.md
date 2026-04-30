# Gen Sage — Safety for Agents

Sage is a lightweight Agent Detection & Response (ADR) layer that protects AI agents from executing dangerous actions on your machine.

## What it does

When an AI agent makes a tool call — running a shell command, writing a file, or fetching a URL — Sage intercepts it and checks for threats before it executes.

### Detection layers

- **URL reputation** — cloud-based lookup for malware, phishing, and scam URLs
- **Local heuristics** — pattern matching against dangerous commands, suspicious URLs, sensitive file paths, credential exposure, and obfuscation techniques
- **Package supply-chain checks** — registry existence, file reputation, and age analysis for npm/PyPI packages

### Verdicts

| Decision | Meaning |
|----------|---------|
| **Allow** | No threats detected — tool call proceeds |
| **Ask** | Suspicious activity — you are prompted for approval |
| **Deny** | Threat detected — tool call is blocked |

## Getting started

1. Install the extension
2. Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Sage auto-enables protection on startup. If it’s not enabled, run **Sage: Enable Protection**.

That's it. Sage now monitors all agent tool calls.

## Hook scope (VS Code)

The VS Code extension installs managed hooks into `~/.copilot/hooks/hooks.json`. This path is shared across GitHub Copilot products that use the `~/.copilot/` configuration directory — including **Copilot CLI**. Protection therefore extends to Copilot CLI agent sessions on the same machine automatically.

## Intercepted tools

The hook runner handles tool names from two products that share the `~/.copilot/hooks/` path:

**VS Code Copilot Chat** — tool names from the [`ToolName` enum](https://github.com/microsoft/vscode-copilot-chat/blob/main/src/extension/tools/common/toolNames.ts):

| Tool name | Action | Input fields |
|---|---|---|
| `run_in_terminal` | Shell command | `command` |
| `create_file` | Create file | `filePath`, `content` |
| `replace_string_in_file` | Edit file | `filePath`, `oldString`, `newString` |
| `insert_edit_into_file` | Edit file | `filePath`, `code` |
| `multi_replace_string_in_file` | Multi-edit | `replacements: [{filePath, oldString, newString}]` |
| `read_file` | Read file | `filePath` |
| `apply_patch` | Apply patch | `input` (patch text) |
| `fetch_webpage` | Fetch URL | `urls` (array) |

**Copilot CLI** — tool names from the [CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference):

| Tool name | Action | Input fields |
|---|---|---|
| `bash` | Shell command | `command` |
| `write_bash` | Shell input | `input` |
| `create` | Create file | `path`, `content` |
| `edit` | Edit file | `path`, `old_string`, `new_string` |
| `view` | Read file | `path` |
| `grep` | Search files | `pattern`, `path` |
| `apply_patch` | Apply patch | `patch` (patch text) |
| `web_fetch` | Fetch URL | `url` |

## MCP server (VS Code vs Cursor)

- **Cursor**: Sage registers and enables the `sage` MCP server automatically on startup (and disables it when protection is disabled until restart).
- **VS Code**: Sage registers the `sage` MCP server definition, but you must start it manually via the command palette: `MCP: List Server` → `sage` → `Start server`.

## Commands

| Command | Description |
| --- | --- |
| `Sage: Enable Protection` | Install managed hooks (and enable the Sage MCP server automatically in Cursor) |
| `Sage: Disable protection until restart` | Remove managed hooks until the next restart (and disable the Sage MCP server automatically in Cursor) |
| `Sage: Open Config` | Open `~/.sage/config.json` |
| `Sage: Open Audit Log` | View the verdict audit trail |
| `Sage: Show Hook Health` | Check hook installation status |

## Privacy

Sage sends URLs and package hashes to Gen Digital reputation APIs. File content, commands, and source code stay local. Both services can be disabled for fully offline operation.

## Links

- [GitHub](https://github.com/gendigitalinc/sage)
- [Configuration docs](https://github.com/gendigitalinc/sage/blob/main/docs/configuration.md)
- [Threat rules](https://github.com/gendigitalinc/sage/blob/main/docs/threat-rules.md)
- [Privacy](https://github.com/gendigitalinc/sage/blob/main/docs/privacy.md)
