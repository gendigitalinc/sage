# Sage

<p align="center">
  <img src="images/logo-shaded.png" alt="Sage" width="250">
</p>

<p align="center">
  <strong>Safety for Agents</strong> — Agent Detection &amp; Response for AI coding assistants
</p>

---

<p align="center">
  <img src="images/block-cc-chmod.gif" alt="Sage blocking a dangerous command in Claude Code" width="700">
</p>

Sage is a lightweight security layer that protects AI agents from executing dangerous actions. It intercepts tool calls — shell commands, URL fetches, file writes — and checks them against multiple threat detection layers before they run.

> **Note:** Sage may appear under a different product name (e.g., Norton Sage, Avast Sage) depending on how it was installed. See [Branding](docs/branding.md) for details.

## Key Features

- **URL reputation** — cloud-based detection of malware, phishing, and scam URLs
- **Local heuristics** — 300+ YAML-based threat patterns for dangerous commands, suspicious URLs, credential exposure, and obfuscation
- **Prompt injection detection** — two-tier defense (heuristics + fine-tuned ML model) against injected instructions in fetched content. See [Prompt Injection](docs/prompt-injection.md)
- **Package supply-chain checks** — registry existence, file reputation, and age analysis for npm/PyPI packages
- **Plugin scanning** — scans installed plugins for threats at session start
- **AMSI integration** — Windows Antimalware Scan Interface support (Windows + WSL via PowerShell interop; no-op on macOS and non-WSL Linux)

## Quick Start

Visit **[ai.gendigital.com/sage](https://ai.gendigital.com/sage)** for the latest installation instructions, or use the platform-specific guides below.

**Claude Code** — [install guide](https://ai.gendigital.com/sage#install-claude-code) · requires [Node.js >= 18](https://nodejs.org/)

```
/plugin marketplace add https://github.com/gendigitalinc/sage.git
/plugin install sage@sage
```

**Cursor** — [install guide](https://ai.gendigital.com/sage#install-cursor) · install the [Gen Sage](https://marketplace.cursorapi.com/items?itemName=Gen.sage-cursor) extension from the marketplace

**VS Code** — [install guide](https://ai.gendigital.com/sage#install-vscode) · install the [Gen Sage](https://marketplace.visualstudio.com/items?itemName=Gen.sage-vscode) extension from the marketplace

**OpenClaw** — [install guide](https://ai.gendigital.com/sage#install-openclaw) · install from npm

```bash
openclaw plugins install @gendigital/sage-openclaw
```

**OpenCode** — install from npm by adding to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["@gendigital/sage-opencode"]
}
```

See [Getting Started](docs/getting-started.md) for detailed instructions and [User Guide](docs/user-guide.md) for verification, configuration, and troubleshooting.

## Privacy

For privacy considerations, please refer to [Privacy](docs/privacy.md).

## Documentation

| Document | Description |
|----------|-------------|
| [User Guide](docs/user-guide.md) | Verify install, handle alerts, manage false positives |
| [Getting Started](docs/getting-started.md) | Installation for all platforms |
| [How It Works](docs/how-it-works.md) | Detection layers, data flow, verdicts |
| [Configuration](docs/configuration.md) | All config options and file paths |
| [Exceptions](docs/exceptions.md) | Pattern-based allow/deny rules |
| [Threat Rules](docs/threat-rules.md) | YAML rule format and what gets checked |
| [Package Protection](docs/package-protection.md) | npm/PyPI supply-chain checks |
| [Plugin Scanning](docs/plugin-scanning.md) | Session-start plugin scanning |
| [Prompt Injection](docs/prompt-injection.md) | ML + heuristic prompt injection detection |
| [AMSI Scanning](docs/amsi-scanning.md) | Windows antimalware scanning via AMSI |
| [MCP Server](docs/mcp.md) | Shared MCP server architecture |
| [Architecture](docs/architecture.md) | Monorepo structure and design decisions |
| [Privacy](docs/privacy.md) | What data is sent, what stays local |
| [Audit Log](docs/audit-log.md) | On-disk JSONL schema (entries, signals, content) |
| [Development](docs/development.md) | Building, testing, tooling, conventions |
| [FAQ](docs/faq.md) | Common questions |

**Platform guides:** [Claude Code](docs/platform-guides/claude-code.md) · [Cursor / VS Code](docs/platform-guides/cursor.md) · [OpenClaw](docs/platform-guides/openclaw.md) · [OpenCode](docs/platform-guides/opencode.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding conventions, and the threat rule contribution process.

## License

Copyright 2026 Gen Digital Inc.

- Source code: [Apache License 2.0](LICENSE)
- Threat detection rules (`threats/`): [Detection Rule License 1.1](threats/LICENSE)
