# Sage — Safety for Agents

<p align="center">
  <img src="https://raw.githubusercontent.com/gendigitalinc/sage/main/images/logo-shaded.png" alt="Sage" width="250">
</p>

<p align="center">
  Protect your AI coding agent from dangerous commands, malicious URLs, and harmful file operations.
</p>

---

<p align="center">
  <img src="https://raw.githubusercontent.com/gendigitalinc/sage/main/images/block-cc-fetch.gif" alt="Sage blocking a malicious URL fetch in Claude Code" width="700">
</p>

## What is Sage?

Sage is a security layer for Claude Code. It intercepts tool calls — Bash commands, URL fetches, file writes — and checks them for threats before they execute. If something looks dangerous, Sage blocks it or asks you to approve.


## What it protects against

- **Malicious URLs** — phishing, malware, and scam sites detected via cloud reputation
- **Dangerous commands** — reverse shells, pipe-to-curl, credential theft, data exfiltration
- **Prompt injection** — heuristics + a fine-tuned ML model detect injected instructions in fetched content
- **Suspicious file operations** — writes to sensitive paths, credential files, system configs
- **Supply-chain attacks** — malicious or typosquatted npm/PyPI packages
- **Compromised plugins** — automatic scanning of installed plugins at session start

## Install

See the [install guide](https://ai.gendigital.com/sage#install-claude-code) for step-by-step instructions. Requires [Node.js >= 18](https://nodejs.org/).

```
/plugin marketplace add https://github.com/gendigitalinc/sage.git
/plugin install sage@sage
```

Sage loads automatically on every session — no configuration needed.

> To verify it's working, ask Claude to run `echo __sage_test_deny_cmd_a75bf229__`. Sage should block this harmless canary command.

## What Sage intercepts

Sage hooks into Claude Code's `PreToolUse` lifecycle:

- **Bash** — shell commands
- **Write / Edit** — file modifications
- **Read** — file reads (sensitive paths)
- **WebFetch** — URL fetches and downloads

## How it works

When Claude makes a tool call, Sage evaluates it and returns a verdict:

| Verdict | What happens |
|---------|-------------|
| **Allow** | No threats detected — the action proceeds normally |
| **Ask** | Suspicious activity — you're prompted to approve or deny |
| **Deny** | Threat detected — the action is blocked |

Sage is designed to fail open: if anything goes wrong internally, the action proceeds. Claude is never blocked due to a Sage error.

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
