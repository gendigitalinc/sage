# OpenClaw

## Installation

Install from npm or build from source:

```bash
# From npm (recommended)
openclaw plugins install @gendigital/sage-openclaw

# From source
pnpm install && pnpm build
cp -r packages/openclaw sage
openclaw plugins install ./sage
```

The build copies threat definitions, allowlists, and skills into `packages/openclaw/resources/`.

## How It Works

The OpenClaw connector runs in-process using the OpenClaw plugin API:

- **`before_tool_call`** - Intercepts `exec`, `web_fetch`, `write`, `edit`, `read`, and `apply_patch`. Runs the full detection pipeline.
- **Native approval** - Flagged actions use OpenClaw's `requireApproval` mechanism, presenting native UI dialogs (Telegram buttons, Discord components, `/approve` command) for user decisions.
- **`gateway_start` / `session_start`** - Scans installed plugins for threats.

## Intercepted Tools

| OpenClaw Tool | Maps To |
|---------------|---------|
| `exec` | Bash command extraction |
| `web_fetch` | URL extraction |
| `write` | File path + content extraction |
| `edit` | File path + content extraction |
| `read` | File path extraction |
| `apply_patch` | File path extraction from diffs |

## Approval Flow

When Sage flags a tool call with an `ask` verdict, it returns a `requireApproval` object. OpenClaw presents a native approval dialog to the user (Telegram buttons, Discord components, or `/approve` command depending on the channel).

The user can:

- **Allow once** — approves the action for the current session only
- **Allow always** — approves and saves an exception rule to `~/.sage/exceptions.json` for permanent allowlisting
- **Deny** — blocks the action

The `onResolution` callback handles persistent allowlisting automatically — when the user selects "Allow always", Sage adds an exception rule without any agent-callable tools.

## Security Awareness Skill

The skill is registered in `openclaw.plugin.json` and bundled into `resources/skills/` during build.

## Code Safety Warning

OpenClaw's `plugins.code_safety` audit will flag Sage with a `potential-exfiltration` warning. This is a false positive - `readFile` and `fetch` coexist in the same bundle because Sage reads local config/cache files and separately sends URLs to a reputation API. No file content is transmitted.
