# User Guide

This guide covers the most common tasks after installing Sage. For installation, see [Getting Started](getting-started.md).

## Verify your installation

After installing Sage, confirm it's working by asking your AI agent to run this harmless canary command:

```
echo __sage_test_ask_cmd_8f2e6b71__
```

The marker string matches a deterministic canary rule (`DUMMY-CMD-ASK-001`) shipped with every connector, so Sage will always flag it regardless of sensitivity preset. Under `balanced` (default) or `relaxed` you'll see your platform's approval flow; under `paranoid`, OpenClaw and OpenCode promote the ask to a deny so you'll see a block instead. For a deny-class canary that blocks on every preset, see the [Getting Started verification step](getting-started.md#verify-it-works).

**What you should see:**

- **Claude Code** — a permission dialog appears asking you to approve or deny the command
- **Cursor / VS Code** — a notification or dialog prompts you before the command runs
- **OpenClaw** — a native approval dialog appears inline
- **OpenCode** — a native OpenCode approval dialog appears via `sage_approve`

**Claude Code:**

![Sage blocking a command in Claude Code](../images/block-cc-chmod.gif)

**Cursor:**

![Sage blocking a command in Cursor](../images/block-cursor-chmod.gif)

If the command runs without any prompt, check that Sage is installed correctly. On Cursor/VS Code, run **Sage: Show hook health** from the command palette.


## Understanding verdicts

Every tool call Sage evaluates gets one of three verdicts:

| Verdict | Meaning | What to do |
|---------|---------|------------|
| **Allow** | No threats detected | Nothing — the action proceeds |
| **Ask** | Suspicious, but not confirmed malicious | Review the action and approve or deny |
| **Deny** | Confirmed threat | The action is blocked automatically |

## Handling flagged actions

When Sage flags an action with an **ask** verdict, you can approve or deny it. The exact options depend on your platform:

| Platform | Approval options |
|----------|-----------------|
| **Claude Code** | Approve or deny via the native permission dialog. Approval is session-only — Sage suggests adding an exception for permanent allowlisting. |
| **Cursor / VS Code** | Approve or deny via the IDE dialog. Approval is session-only. |
| **OpenClaw** | Approve once, **allow always** (auto-creates an exception rule), or deny via native approval dialog. |
| **OpenCode** | Approve or deny via the native approval dialog (surfaced when the agent calls `sage_approve`). Approval is session-only. |

To permanently suppress a pattern on any platform, add an exception rule manually — see below.

## Managing false positives

If Sage repeatedly flags actions you trust, you have several options:

### Quick: allow always (OpenClaw only)

On OpenClaw, select **Allow always** when prompted. This automatically creates an exception rule in `~/.sage/exceptions.json`.

On other platforms, approval is session-only. To permanently allow a pattern, add an exception rule manually:

### Add an exception rule

Edit `~/.sage/exceptions.json` (or run **Sage: Open exceptions** in Cursor/VS Code):

```json
{
  "rules": [
    {
      "decision": "allow",
      "match": "executable",
      "pattern": "docker build",
      "reason": "Docker builds are part of my workflow"
    }
  ]
}
```

Exception rules support matching by executable name, domain, file path, plugin key, or regex. See [Exceptions](exceptions.md) for the full reference and examples.

### Report a false positive

Sage includes an MCP server with a built-in false positive reporting tool. If your agent has access to Sage's MCP tools, you can ask it to report a false positive directly:

1. Ask your agent: *"List recent Sage audit entries"* — this calls `sage_list_audit_entries`
2. Identify the entry that was a false positive
3. Ask your agent: *"Report this as a false positive because [reason]"* — this calls `sage_report_false_positive`

The report is sent to Gen Digital so the detection rules can be improved. No source code or file content is included in the report.

> **Note:** The MCP tools are available automatically in Cursor. In VS Code, start the MCP server first via `MCP: List Server` → `sage` → `Start server`. In Claude Code, the MCP server is registered by the plugin.

### Disable a specific rule

If a particular threat rule doesn't apply to your workflow, disable it by ID in `~/.sage/config.json`:

```json
{
  "disabled_threats": ["CLT-CMD-001"]
}
```

Threat IDs are listed in the YAML files under `threats/` in the [source repository](https://github.com/gendigitalinc/sage/tree/main/threats). See [Configuration](configuration.md#disabled_threats).

## Adjusting sensitivity

Sage has three sensitivity presets that control how aggressively it flags actions:

| Preset | Behavior |
|--------|----------|
| `paranoid` | Flags anything remotely suspicious |
| `balanced` | Blocks confirmed threats, prompts on suspicious (default) |
| `relaxed` | Only blocks high-confidence threats |

Set in `~/.sage/config.json`:

```json
{
  "sensitivity": "paranoid"
}
```

See [Configuration](configuration.md#sensitivity) for details.

## Going fully offline

Sage's detection layers can run entirely offline. To disable all cloud services:

```json
{
  "url_check": { "enabled": false },
  "file_check": { "enabled": false },
  "package_check": { "enabled": false },
  "community_iq": false
}
```

Local heuristics (300+ YAML-based threat patterns) handle detection without network access. A lightweight session-start version check still posts basic environment info (Sage version, agent runtime, OS, installation ID — no commands, URLs, or file content); see [Privacy](privacy.md) for the full breakdown.

## Disabling Sage temporarily

| Platform | How to disable |
|----------|---------------|
| **Claude Code** | Uninstall the plugin or run Claude without the plugin |
| **Cursor / VS Code** | Run **Sage: Disable protection until restart** from the command palette |
| **OpenClaw** | `openclaw plugins uninstall sage` |
| **OpenCode** | Remove the plugin path from `opencode.json` |

You can also disable individual detection layers in `~/.sage/config.json` without uninstalling. See [Configuration](configuration.md).

## Reporting issues

- **Bug reports and feature requests:** [GitHub Issues](https://github.com/gendigitalinc/sage/issues)
- **False positive reports:** If Sage flags a legitimate action, add an [exception rule](exceptions.md) to suppress it and consider [opening an issue](https://github.com/gendigitalinc/sage/issues) so we can improve the detection rules.
