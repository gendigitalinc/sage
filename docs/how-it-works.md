# How It Works

Sage intercepts tool calls made by AI agents, extracts security-relevant artifacts, and checks them against multiple threat detection layers.

## Detection Layers

1. **URL reputation** - Cloud-based lookup for malware, phishing, and scam URLs. Works without an API key.
2. **Local heuristics** - YAML-based regex patterns matching dangerous commands, suspicious URLs, sensitive file paths, credential exposure, and obfuscation techniques.
3. **Prompt injection detection** - Two-tier defense: heuristic regex rules (~0.001ms) catch common injection patterns, followed by a fine-tuned ML model (~17ms) for subtle attacks. See [Prompt Injection Detection](prompt-injection.md).
4. **Package supply-chain checks** - Registry existence, file reputation, and age analysis for npm/PyPI packages. See [Package Protection](package-protection.md).
5. **Plugin scanning** - Scans other installed plugins for threats at session start. See [Plugin Scanning](plugin-scanning.md).

## Intercepted Tools

| Platform | Hooks / Tools |
|----------|---------------|
| Claude Code | `PreToolUse` on `Bash`, `WebFetch`, `Write`, `Edit`, `Read` |
| Cursor | `beforeShellExecution`, `preToolUse` (Write, Edit, Delete, WebFetch), `beforeMCPExecution`, `beforeReadFile` |
| VS Code (Copilot) | `PreToolUse` on all Copilot agent tools (`run_in_terminal`, `create_file`, `replace_string_in_file`, `insert_edit_into_file`, `multi_replace_string_in_file`, `read_file`, `fetch_webpage`, `apply_patch`). Hooks are installed at `~/.copilot/hooks/hooks.json`, which is also read by Copilot CLI — so protection covers CLI agent sessions too. Copilot CLI tools: `bash`, `write_bash`, `view`, `create`, `edit`, `grep`, `web_fetch`. |
| OpenClaw | `exec`, `web_fetch`, `write`, `edit`, `read`, `apply_patch` |

## Data Flow

```
Tool call received (PreToolUse)
  │
  ├─ Extract artifacts (URLs, commands, file paths, content)
  │
  ├─ Check allowlist → if allowlisted → allow
  │
  ├─ Check cache → if cached → use cached verdict
  │
  ├─ Run local heuristics (pattern matching against threat definitions)
  │
  ├─ Query URL reputation (for extracted URLs)
  │
  ├─ Check packages (for install commands / manifest writes)
  │
  ├─ ML prompt injection check (if enabled, skipped if heuristics already caught PI)
  │
  ├─ Decision engine combines all signals → verdict
  │
  ├─ Cache result
  │
  └─ Audit log → return verdict

Tool output received (PostToolUse)
  │
  ├─ Extract output content (Read content, Bash stdout, WebFetch response)
  │
  ├─ Run PI heuristic rules on output content
  │
  ├─ ML prompt injection check (if enabled, skipped if heuristics caught PI)
  │
  └─ Return warning via additionalContext (PostToolUse cannot block)
```

## Verdicts

| Decision | Meaning |
|----------|---------|
| `allow`  | No threats detected — tool call proceeds |
| `ask`    | Suspicious — user presented with approval dialog |
| `deny`   | Confirmed threat — tool call blocked |

When multiple signals fire, merge precedence is: `deny > ask > allow`.

## Fail-Open Design

Sage is designed to never break the agent. Every internal error path returns an `allow` verdict. Extension hooks (Cursor / VS Code) always exit with code `0`; the host uses the JSON response to decide whether to block the tool call. If the URL reputation API is down or times out, Sage falls back to heuristics only.

## Sensitivity Presets

The confidence threshold determines when a detection escalates from `ask` to `deny`:

| Preset | Threshold | Behavior |
|--------|-----------|----------|
| `paranoid` | 0.70 | Blocks on any suspicion |
| `balanced` | 0.85 | Blocks confirmed threats, warns on suspicious (default) |
| `relaxed` | 0.95 | Only blocks high-confidence threats |

Configure in `~/.sage/config.json` with `"sensitivity": "paranoid"`.

On connectors that route through `guardToolCall` (OpenClaw and OpenCode), `paranoid` mode also promotes all `ask` verdicts to `deny`. This prevents prompt-injection attacks from auto-approving flagged actions in flows where the agent — rather than a fully isolated UI — mediates approval. Claude Code and the Cursor/VS Code extension use native approval dialogs on a separate code path and are unaffected.
