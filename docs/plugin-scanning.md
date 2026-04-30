# Plugin Scanning

Sage scans other installed plugins for threats at every session start. Each plugin's files are run through the same threat definitions and URL checks used for runtime tool interception, and any skill packages bundled with the plugin are checked against the Sage skill-check service.

## Supported Platforms

| Platform | Plugin Source |
|----------|-------------|
| Claude Code | `~/.claude/plugins/installed_plugins.json` |
| OpenClaw | `~/.openclaw/extensions/` directory |

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
      "severity": "high",
      "confidence": 0.9,
      "artifact": "curl ... | bash",
      "source_file": "setup.sh"
    }
  ]
}
```

> **Note:** Claude Code does not currently provide a hook for plugin installation events. The session-start approach ensures all plugins are scanned before each session begins.
