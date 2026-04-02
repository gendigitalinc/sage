# FAQ

## Is Sage always running?

On Claude Code, yes - it loads automatically via hooks on every session. On Cursor/VS Code, Sage auto-enables protection on every startup. On OpenClaw, it runs once installed as a plugin.

## What happens if Sage encounters an error?

Sage fails open. Any internal error (API timeout, config parse failure, etc.) results in an `allow` verdict. The agent is never blocked due to a Sage bug.

## Does Sage send my code to the cloud?

No. Sage sends URLs and package hashes to reputation APIs. File content, commands, and source code stay local. See [Privacy](privacy.md) for details.

## How do I handle false positives?

When Sage shows an `ask` verdict, you can choose to proceed. To permanently suppress a pattern, add an exception rule to `~/.sage/exceptions.json`:

```json
{
  "rules": [
    {
      "decision": "allow",
      "match": "executable",
      "pattern": "rm",
      "reason": "I trust rm in my workflow"
    }
  ]
}
```

On Cursor/VS Code, run **Sage: Open exceptions** from the command palette for quick access. Exceptions support matching by executable name, domain, file path, plugin key, or regex — see [Exceptions](exceptions.md) for the full reference.

Existing entries in the legacy `~/.sage/allowlist.json` are still honored.

## Can I disable a specific threat rule?

Yes. Add its ID to `disabled_threats` in `~/.sage/config.json`. Threat IDs are in the YAML files under `threats/`. See [Configuration](configuration.md#disabled_threats).

## Can I add custom threat rules?

Not yet. Custom user threat definitions (`~/.sage/threats/`) are planned but not yet implemented. Currently, only the rules shipped in `threats/` are used.

## Does Sage work offline?

Partially. Local heuristics (pattern matching against YAML rules) work fully offline. URL reputation and package checks require network access but degrade gracefully - if the API is unreachable, Sage falls back to heuristics only.

## What about MCP tool calls?

MCP tool call interception (`mcp__*`) is planned but not yet implemented. Currently Sage only intercepts the built-in tools listed in [How It Works](how-it-works.md#intercepted-tools).

## How do I disable Sage temporarily?

- **Claude Code:** Uninstall the plugin or run Claude without `--plugin-dir`
- **Cursor/VS Code:** Run `Sage: Disable protection until restart` from the command palette. Protection re-enables automatically on the next startup.
- **OpenClaw:** Uninstall the plugin via `openclaw plugins uninstall sage`

You can also disable individual features in `~/.sage/config.json` (e.g. set `url_check.enabled` to `false`).

## How do I prevent the agent from auto-approving flagged actions on OpenClaw or OpenCode?

OpenClaw and OpenCode relay `ask` verdicts through the agent conversation, so a prompt-injection attack could trick the agent into approving without user consent. (Claude Code and Cursor use native UI dialogs and are not affected.)

Set `"sensitivity": "paranoid"` in `~/.sage/config.json` to promote `ask` verdicts to `deny` on these platforms, removing the agent from the approval loop. See [Configuration](configuration.md#sensitivity).

## Why does OpenClaw flag Sage as "potential-exfiltration"?

This is a false positive. OpenClaw's `code_safety` audit fires when `readFile` and `fetch` coexist in the same bundle. Sage reads local files (config, cache, YAML) and separately sends URLs to a reputation API. No file content crosses the network.
