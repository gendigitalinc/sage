# Plugin Scanning

Sage scans other installed plugins for threats at every session start. Each plugin's files are run through the same threat definitions and URL checks used for runtime tool interception, and any skill packages bundled with the plugin are checked against the Sage skill-check service.

## Supported Platforms

| Platform | Plugin Source |
|----------|-------------|
| Claude Code | `~/.claude/plugins/installed_plugins.json` |
| Cursor | `~/.cursor/extensions/` directory |
| VS Code | `~/.vscode/extensions/` directory |
| OpenClaw | `~/.openclaw/extensions/` directory |
| OpenCode | npm packages from `opencode.json` (global + project) and local plugins in `~/.config/opencode/plugins/` and `.opencode/plugins/` |

## How It Works

1. At session start, Sage reads the list of installed plugins
2. Each plugin's source files are scanned against threat definitions
3. URLs found in plugin code are checked against URL reputation
4. Results are cached locally and only re-checked when a plugin changes
5. Findings are logged to the audit log with `type: "plugin_scan"`

## Audit Log Entry

```json
{
  "type": "plugin_scan",
  "timestamp": "2026-02-09T10:30:00Z",
  "plugin_key": "example-plugin@marketplace",
  "findings_count": 1,
  "findings": [
    {
      "threat_id": "CLT-CMD-001",
      "title": "Pipe to shell",
      "severity": "warning",
      "confidence": 0.9,
      "artifact": "curl ... | bash",
      "source_file": "setup.sh"
    }
  ]
}
```

> **Note:** Claude Code does not currently provide a hook for plugin installation events. The session-start approach ensures all plugins are scanned before each session begins.

## OpenCode-specific behavior

- **Trigger:** scan runs on the first `session.updated` event per session and is deduplicated by session ID
- **Cache:** results are stored at `~/.sage/plugin_scan_cache.json` and reused until a plugin's content changes
- **Self-protection:** Sage skips its own package (`@gendigital/sage-opencode`) when enumerating plugins
- **Findings surfacing:** any findings are injected as a `<system-reminder>` into the first user message of the session so the agent surfaces them to the user; nothing is appended to system prompts or assistant turns
