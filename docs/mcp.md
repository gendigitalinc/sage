# MCP Server Architecture

Sage ships a shared MCP (Model Context Protocol) server implementation to support:

- **False-positive reporting** from the local audit log (`~/.sage/audit.jsonl`) to Sage Proxy (`POST /v2/fp-report`).
- (Optional) **Allowlist management** tools, when the host platform can provide “recent user approval” signals.

This document explains:

- What the shared MCP server is (`@gendigital/sage-mcp`)
- Which clients are supported
- How Sage registers the MCP server on supported clients

## High-level design

Sage’s MCP server is implemented once in `@gendigital/sage-mcp` and then **bundled** into each platform distribution that needs a runnable MCP server process.

```mermaid
flowchart TD
  auditLog[~/.sage/audit.jsonl]
  core[@gendigital/sage-core]
  mcp[@gendigital/sage-mcp]
  host[HostClient(CLI/IDE)]
  sageProxy[SageProxy(/v2/fp-report)]

  core --> auditLog
  mcp --> core
  host -->|stdio JSON-RPC| mcp
  mcp -->|"POST /v2/fp-report"| sageProxy
  mcp -->|"read + filter by conversation_id"| auditLog
```

### Packages involved

- `packages/core` (`@gendigital/sage-core`)
  - Detection engine, config, allowlist, and **audit log writer**.
  - Audit entries now include:
    - `entry_id` (UUID)
    - `conversation_id` (used for report scoping)
    - `agent_runtime` (best-effort source platform identifier)
    - `signals` (best-effort structured signal metadata for reporting)
- `packages/mcp` (`@gendigital/sage-mcp`)
  - Shared MCP server implementation (stdio transport) + tool registration.
- Reads the audit log via `@gendigital/sage-core` and sends reports via HTTP `POST /v2/fp-report`.
- Platform bundles (runnable scripts)
  - Claude Code: `packages/claude-code/dist/mcp-server.cjs`
  - Cursor/VS Code VSIX: `packages/extension/dist/mcp-server.cjs`

## Supported clients

### Claude Code

- Uses the plugin manifest `.claude-plugin/plugin.json` to register `mcpServers.sage`.
- Sage bundles the MCP server into `packages/claude-code/dist/mcp-server.cjs`.

### Cursor

- Sage registers the `sage` MCP server via Cursor’s MCP API.
- Cursor handles enable/disable automatically based on whether Sage protection is enabled.

### VS Code

Sage’s VS Code extension manages Claude-style settings (in `~/.claude/settings.json` or workspace `.claude/settings.json`) for **hooks**.

For **MCP**, Sage registers an MCP server definition provider so that the server shows up in VS Code’s MCP UI.

- VS Code requires a manual start. Use the command palette: `MCP: List Server` → `sage` → `Start server`.

## Tooling

### `sage_list_audit_entries`

Lists recent audit entries from `~/.sage/audit.jsonl`, optionally filtered by `conversation_id`. This is intended to help users pick `entry_id`s for reporting.

### `sage_report_false_positive`

Reports audit entries as false positives to Sage Proxy (`POST /v2/fp-report`).

- **Scoping**: filters to entries matching `conversation_id`.
  - If `conversation_id` is not provided, Sage will infer it from the most recent `runtime_verdict` entry in the audit log.
- **User input**: the tool requires:
  - `description`: a short description of what is wrong
  - `reasoning`: why it’s a false positive
- **Payload**: one report per audit entry, shaped like the Sage FP Submit Structure (see `sage_fp_handling_implementation.md` in this branch for the full schema).

## Configuration

The `sage_report_false_positive` tool is always available (it cannot be disabled via configuration).

Environment overrides:

- `SAGE_FALSE_POSITIVE_TIMEOUT_SECONDS`
- `SAGE_AGENT_RUNTIME_VERSION` (used when the caller does not provide an explicit agent runtime version)

## Auto-installation details

### Cursor (VSIX)

- On startup (and when protection is manually re-enabled), Sage registers the `sage` MCP server via `vscode.cursor.mcp.registerServer(...)`.
- When protection is disabled until restart, Sage unregisters it via `vscode.cursor.mcp.unregisterServer("sage")`. The server is re-registered on the next startup.

### VS Code (VSIX)

- VS Code does not currently expose an API to programmatically enable/disable (start/stop) an MCP server.
- Sage registers a server definition provider (via `contributes.mcpServerDefinitionProviders` + `vscode.lm.registerMcpServerDefinitionProvider(...)`) so the server appears in the MCP UI.
- The user must start the server manually using: `MCP: List Server` → `sage` → `Start server`.

## Notes and constraints

- **No copy/paste across connectors**: protocol + tool logic lives in `@gendigital/sage-mcp`; connectors only provide a thin runnable entrypoint and (optionally) an allowlist approval adapter.
- **Conversation id quality is host-dependent**: Sage records the best available conversation/session identifier from each host and stores it as `conversation_id` in the audit log.
