# Sage

**Safety for Agents** - a lightweight Agent Detection & Response (ADR) layer for AI agents that guards commands, files, and web requests.

<p align="center">
  <img src="images/sage-logo-shaded.png" alt="Sage" width="50%">
</p>

Sage intercepts tool calls (Bash commands, URL fetches, file writes) via hook systems in [Claude Code](docs/platform-guides/claude-code.md), [Cursor / VS Code](docs/platform-guides/cursor.md), [OpenClaw](docs/platform-guides/openclaw.md), and [OpenCode](docs/platform-guides/opencode.md), and checks them against:

- **URL reputation** - cloud-based malware, phishing, and scam detection
- **Local heuristics** - YAML-based threat definitions for dangerous patterns
- **Prompt injection detection** - two-tier defense against prompt injection attacks using heuristic rules and a fine-tuned ML model. See [Prompt Injection Detection](docs/prompt-injection.md)
- **Package supply-chain checks** - registry existence, file reputation, and age analysis for npm/PyPI packages
- **Plugin scanning** - scans other installed plugins for threats at session start

## Quick Start

### Claude Code

Requires [Node.js >= 18](https://nodejs.org/).

```
/plugin marketplace add https://github.com/gendigitalinc/sage.git
/plugin install sage@sage
```

### Cursor

[Install](cursor:extension/Gen.sage-cursor) the official extension from the Cursor extension marketplace. Alternatively, build from source:

```bash
pnpm install && pnpm -C packages/extension run package:cursor:vsix
```

### VS Code

[Install](vscode:extension/Gen.sage-vscode) the official extension from the VS Code extension marketplace. To use Sage’s MCP tools, start the MCP server manually via: `MCP: List Server` → `sage` → `Start server`.

Alternatively, build from source:

```bash
pnpm install && pnpm -C packages/extension run package:vscode:vsix
```

### OpenClaw

```bash
# From npm (recommended)
openclaw plugins install @gendigital/sage-openclaw

# From source
pnpm install && pnpm build
cp -r packages/openclaw sage && openclaw plugins install ./sage
```

### OpenCode

Use a local source checkout and add the plugin path in OpenCode config:

```bash
git clone https://github.com/gendigitalinc/sage
cd sage
pnpm install
pnpm --filter @gendigital/sage-opencode run build
```

```json
{
  "plugin": ["/absolute/path/to/sage/packages/opencode"]
}
```

See [Getting Started](docs/getting-started.md) for detailed instructions.

## Documentation

| Document                                         | Description                                    |
| ------------------------------------------------ | ---------------------------------------------- |
| [Getting Started](docs/getting-started.md)       | Installation for all platforms                 |
| [How It Works](docs/how-it-works.md)             | Detection layers, data flow, verdicts          |
| [Configuration](docs/configuration.md)           | All config options and file paths              |
| [Threat Rules](docs/threat-rules.md)             | YAML rule format and what gets checked         |
| [Package Protection](docs/package-protection.md) | npm/PyPI supply-chain checks                   |
| [Plugin Scanning](docs/plugin-scanning.md)       | Session-start plugin scanning                  |
| [Prompt Injection](docs/prompt-injection.md)     | ML + heuristic prompt injection detection      |
| [AMSI Scanning](docs/amsi-scanning.md)           | Windows antimalware scanning via AMSI          |
| [Architecture](docs/architecture.md)             | Monorepo structure, packages, design decisions |
| [MCP Server](docs/mcp.md)                        | Shared MCP server architecture + auto-install  |
| [Audit Log](docs/audit-log.md)                   | On-disk JSONL schema (entries, signals, content) |
| [Development](docs/development.md)               | Building, testing, tooling, conventions        |
| [FAQ](docs/faq.md)                               | Common questions                               |
| [Privacy](docs/privacy.md)                       | What data is sent, what stays local            |

**Platform guides:** [Claude Code](docs/platform-guides/claude-code.md) · [Cursor / VS Code](docs/platform-guides/cursor.md) · [OpenClaw](docs/platform-guides/openclaw.md) · [OpenCode](docs/platform-guides/opencode.md)

## Current Limitations

- MCP tool call interception (`mcp__*`) is not yet implemented
- Custom user threat definitions (`~/.sage/threats/`) are not yet implemented

## Privacy

Sage sends URLs and package hashes to Gen Digital reputation APIs. File content, commands, and source code stay local. Both services can be disabled for fully offline operation. See [Privacy](docs/privacy.md) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding conventions, and the threat rule contribution process.

## License

Copyright 2026 Gen Digital Inc.

- Source code: [Apache License 2.0](LICENSE)
- Threat detection rules (`threats/`): [Detection Rule License 1.1](threats/LICENSE)
