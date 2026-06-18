# Sage — Safety for Agents

<p align="center">
  <img src="https://raw.githubusercontent.com/gendigitalinc/sage/main/images/logo-shaded.png" alt="Sage" width="250">
</p>

<p align="center">
  Protect your AI coding agent from dangerous commands, malicious URLs, and harmful file operations.
</p>

---

<p align="center">
  <img src="https://raw.githubusercontent.com/gendigitalinc/sage/main/images/block-opencode-allow.gif" alt="Sage blocking a dangerous command in OpenCode" width="700">
</p>

## What is Sage?

Sage is a security layer for OpenCode. It intercepts tool calls — bash commands, URL fetches, file operations — and checks them for threats before they execute. If something looks dangerous, Sage blocks it or asks you to approve via OpenCode's native approval dialog.


## What it protects against

- **Malicious URLs** — phishing, malware, and scam sites detected via cloud reputation
- **Dangerous commands** — reverse shells, pipe-to-curl, credential theft, data exfiltration
- **Prompt injection** — heuristics + a fine-tuned ML model detect injected instructions in fetched content
- **Suspicious file operations** — writes to sensitive paths, credential files, system configs
- **Supply-chain attacks** — malicious or typosquatted npm/PyPI packages
- **Compromised plugins** — automatic scanning of installed plugins at session start

## Install

Add the plugin to your OpenCode config (`~/.config/opencode/opencode.json`):

```json
{
  "plugin": ["@gendigital/sage-opencode"]
}
```

Or [build from source](https://github.com/gendigitalinc/sage/blob/main/docs/user-guide.md#opencode).

> To verify it's working, ask your agent to run `echo __sage_test_deny_cmd_a75bf229__`. Sage should block this harmless canary command.

## What Sage intercepts

Sage hooks into OpenCode's plugin system:

- **bash** — shell commands
- **write / edit** — file modifications
- **read** — file reads (sensitive paths)
- **webfetch** — URL fetches and downloads
- **ls / glob / grep** — file system operations

## How it works

When your agent makes a tool call, Sage evaluates it and returns a verdict:

| Verdict | What happens |
|---------|-------------|
| **Allow** | No threats detected — the action proceeds normally |
| **Ask** | Suspicious activity — OpenCode shows a native approval dialog |
| **Deny** | Threat detected — the action is blocked |

For `ask` verdicts, Sage blocks the tool call and the agent calls `sage_approve({ actionId })`, which surfaces OpenCode's native approval dialog. If you approve, the agent retries the original tool call.

Sage is designed to fail open: if anything goes wrong internally, the action proceeds. Your agent is never blocked due to a Sage error.

> **Note:** In `paranoid` sensitivity mode, `ask` verdicts are promoted to `deny` on OpenCode. This prevents prompt-injection attacks from auto-approving flagged actions.

## Configuration

Sage works out of the box with no configuration. To customize behavior, edit `~/.sage/config.json`:

```json
{
  "sensitivity": "balanced",
  "url_check": { "enabled": true },
  "heuristics_enabled": true
}
```

See [Configuration](https://github.com/gendigitalinc/sage/blob/main/docs/user-guide.md#configuration) for all options.

## Links

- [User Guide](https://github.com/gendigitalinc/sage/blob/main/docs/user-guide.md) — verify install, handle alerts, manage false positives
- [Configuration](https://github.com/gendigitalinc/sage/blob/main/docs/user-guide.md#configuration) — all config options
- [Exceptions](https://github.com/gendigitalinc/sage/blob/main/docs/user-guide.md#exceptions) — pattern-based allow/deny rules
- [Privacy](https://github.com/gendigitalinc/sage/blob/main/docs/user-guide.md#privacy) — what data is sent, what stays local
- [GitHub](https://github.com/gendigitalinc/sage)
