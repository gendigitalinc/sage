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
  - Detection engine, config, exceptions, and **audit log writer**.
  - Audit entries now include:
    - `entry_id` (UUID)
    - `conversation_id` (used for report scoping)
    - `agent_runtime` (best-effort source platform identifier)
    - `signals` (best-effort structured signal metadata for reporting, including `amsi_checks` on Windows/WSL)
    - `content` (structured snapshot of the tool input, sanitized — same shape as the detection-telemetry `content` field; per-field caps and home-path scrubbing applied upstream by `buildContentSnapshot`)

    See [Audit Log](audit-log.md) for the full on-disk schema.
- `packages/mcp` (`@gendigital/sage-mcp`)
  - Shared MCP server implementation (stdio transport) + tool registration.
- Reads the audit log via `@gendigital/sage-core` and sends reports via HTTP `POST /v2/fp-report`.
- Platform bundles (runnable scripts)
  - Claude Code: `packages/claude-code/dist/mcp-server.cjs`
  - Cursor/VS Code VSIX: `packages/extension/dist/mcp-server.cjs`
  - OpenCode: `packages/opencode/dist/mcp-server.cjs`
  - OpenClaw: `packages/openclaw/dist/mcp-server.cjs`

## Supported clients

### Claude Code

- Uses the plugin manifest `.claude-plugin/plugin.json` to register `mcpServers.sage`.
- Sage bundles the MCP server into `packages/claude-code/dist/mcp-server.cjs`.

### Cursor

- Sage registers the `sage` MCP server via Cursor’s MCP API.
- Cursor handles enable/disable automatically based on whether Sage protection is enabled.

### VS Code

Sage’s VS Code extension manages Copilot hooks (in `~/.copilot/hooks/hooks.json`) for **hooks**.

For **MCP**, Sage registers an MCP server definition provider so that the server shows up in VS Code’s MCP UI.

- VS Code requires a manual start. Use the command palette: `MCP: List Server` → `sage` → `Start server`.

### OpenCode

- The Sage plugin’s `config` hook injects `mcp.sage` into the resolved config before OpenCode’s MCP service initialises, so the server is auto-registered with no user configuration required.
- `process.execPath` (the running Bun/opencode binary) is used as the server command with `BUN_BE_BUN=1`, so the server runs correctly regardless of whether a separate `node` binary is on PATH.

### OpenClaw

- OpenClaw’s native plugin API does not support programmatic MCP server registration.
- Users must add the server manually to their OpenClaw `mcp.servers` config, pointing at `packages/openclaw/dist/mcp-server.cjs` with `node` as the runtime. See the [OpenClaw Platform Guide](user-guide.md#openclaw) for the exact config snippet.

## Tooling

### `sage_list_audit_entries`

Lists recent reportable audit entries from `~/.sage/audit.jsonl`. Runtime verdicts are optionally filtered by `conversation_id`; risky Skill Analyzer verdicts are listed globally because detached analysis can finish after the originating conversation. The optional `limit` is applied after audit and cache candidates are merged. This is intended to help users pick `entry_id`s for reporting.

### `sage_report_false_positive`

Reports audit entries as false positives to Sage Proxy (`POST /v2/fp-report`).

- **Scoping**: runtime verdicts are filtered to entries matching `conversation_id`.
  - If `conversation_id` is not provided, Sage will infer it from the most recent `runtime_verdict` entry in the audit log.
  - Skill Analyzer verdicts have no reliable conversation association and must be selected explicitly by `entry_id`.
- **User input**: the tool requires:
  - `description`: a short description of what is wrong
  - `reasoning`: why it’s a false positive
- **Entry selection**: callers should call `sage_list_audit_entries` first and pass the relevant `entry_id`(s) via the `entry_ids` parameter.
  - With `entry_ids` provided: at most **10** entries per call. Larger arrays are rejected with an actionable error.
  - With `entry_ids` omitted (fallback): `allow` verdicts are filtered out and only the **3** most recent `deny` / `ask` entries for the conversation are submitted, to avoid flooding the backend with unrelated verdicts.
- **Skill reports**: Sage merges audit entries with a non-mutating, TTL-filtered read of `skill_verdict_cache.json`, using generation timestamps to select the newest result for each valid SHA-256 `skill_id`. The cache provides a fallback when an audit entry has rotated or could not be written, without overriding a newer audit generation. Audit candidates use the same configured skill-cache TTL, so expired risky results do not reappear. Only current `HIGH` / `CRITICAL` results are exposed; a newer `SAFE` result suppresses an older risky result. Sage reconstructs each skill signal from its normalized verdict and content hash, so legacy or stale signal metadata cannot override the canonical name. Reports use `hook_type=SessionStart`, `tool_type=Skill`, and carry `signals.skill_checks` with `detection_name`, `skill_id`, optional `job_id`, and `analyzer_verdict`. `HIGH` reports use `Other:SageSuspiciousSkill-A [Susp]|skan:<skill_id>|sage`; `CRITICAL` reports use `Other:SageMaliciousSkill-A [Trj]|skan:<skill_id>|sage`. Analyzer summaries are intentionally omitted from the globally scoped listing.
- **Payload**: one report per selected entry, shaped like the Sage FP Submit Structure. It includes standard Sage context (runtime/platform metadata plus current Sage protection settings). For runtime entries, a non-empty structured `content` field stored on the audit entry is forwarded verbatim — the tool does not reconstruct content from the truncated `tool_input_summary`. Empty content is omitted, including for Skill Analyzer reports.

## Configuration

The `sage_report_false_positive` tool is always available (it cannot be disabled via configuration).

Environment overrides:

- `SAGE_FALSE_POSITIVE_TIMEOUT_SECONDS`
- `SAGE_APP_ROOT` — absolute path to the host application root (`vscode.env.appRoot` for Cursor / VS Code). When set, the MCP server reads `product.json` from this directory at startup to resolve the host runtime version (e.g. Cursor `3.1.14`, VS Code `1.117.0`). Set automatically by the Sage extension when it registers the MCP server; only needs to be supplied manually for non-extension hosts.
- `SAGE_AGENT_RUNTIME_VERSION` — fallback used when the caller does not provide an explicit agent runtime version and `SAGE_APP_ROOT` is unset or its `product.json` is unreadable. If neither resolves to a value, the runtime version is reported as `"unknown"`.

## Auto-installation details

### Cursor (VSIX)

- On startup (and when protection is manually re-enabled), Sage registers the `sage` MCP server via `vscode.cursor.mcp.registerServer(...)`.
- When protection is disabled until restart, Sage unregisters it via `vscode.cursor.mcp.unregisterServer("sage")`. The server is re-registered on the next startup.

### VS Code (VSIX)

- VS Code does not currently expose an API to programmatically enable/disable (start/stop) an MCP server.
- Sage registers a server definition provider (via `contributes.mcpServerDefinitionProviders` + `vscode.lm.registerMcpServerDefinitionProvider(...)`) so the server appears in the MCP UI.
- The user must start the server manually using: `MCP: List Server` → `sage` → `Start server`.

## Notes and constraints

- **No copy/paste across connectors**: protocol + tool logic lives in `@gendigital/sage-mcp`; connectors only provide a thin runnable entrypoint and (optionally) an approval adapter.
- **Conversation id quality is host-dependent**: Sage records the best available conversation/session identifier from each host and stores it as `conversation_id` in the audit log.
- **Skill verdict freshness**: skill and plugin-scan caches use `skill_check.cache_ttl_days` (one day by default). Backend verdict changes therefore reach a client after the cached result expires and the next session-start lookup completes. FP selection compares audit and cache generation timestamps, using input order only to break ties.
- **Skill-report ingestion contract**: `/v2/fp-report` must accept and store `block_event.signals.skill_checks`. Warehouse ingestion must model that value as a repeated record containing `detection_name`, `skill_id`, `job_id`, and `analyzer_verdict`; `hook_type=SessionStart` plus `tool_type=Skill` is the source marker.
