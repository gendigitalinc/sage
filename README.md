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

See the [User Guide](docs/user-guide.md) for detailed instructions, configuration, and troubleshooting.

## Privacy

For privacy considerations, please refer to [Privacy](docs/user-guide.md#privacy).

## Documentation

| Document | Description |
|----------|-------------|
| [User Guide](docs/user-guide.md) | Installation, usage, configuration, exceptions, platform guides, privacy, FAQ |
| [Developer Guide](docs/developer-guide.md) | Architecture, development setup, testing, threat rule format |
| [Prompt Injection](docs/prompt-injection.md) | ML + heuristic prompt injection detection |
| [Package Protection](docs/package-protection.md) | npm/PyPI supply-chain checks |
| [AMSI Scanning](docs/amsi-scanning.md) | Windows antimalware scanning via AMSI |
| [Plugin Scanning](docs/plugin-scanning.md) | Session-start plugin scanning |
| [Audit Log](docs/audit-log.md) | On-disk JSONL schema (entries, signals, content) |
| [MCP Server](docs/mcp.md) | Shared MCP server architecture |
| [Decision Pipeline](docs/decision-pipeline.md) | Signal sources, policy model, evaluation order |
| [Branding](docs/branding.md) | Product name configuration |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding conventions, and the threat rule contribution process.

## License

Copyright 2026 Gen Digital Inc.

- Source code: [Apache License 2.0](LICENSE)
- Threat detection rules (`threats/`): [Detection Rule License 1.1](threats/LICENSE)
