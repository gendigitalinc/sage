# Prompt Injection Detection

Sage detects prompt injection attacks in content processed by AI agents using a two-tier approach.

## Overview

Prompt injection is an attack where malicious instructions are embedded in content (files, web pages, command output) that an AI agent reads. The goal is to override the agent's instructions — for example, tricking it into exfiltrating credentials or executing unauthorized commands.

Sage scans content using two independent tiers:

- **Tier 1 (heuristics)** — regex-based rules that run on all tools at both PreToolUse and PostToolUse.
- **Tier 2 (ML model)** — a machine learning classifier that runs only on **WebFetch** at PreToolUse via content pre-fetching. Sage fetches the URL itself, scans the raw content, and blocks before the agent sees the page.

## Detection Tiers

### Tier 1: Heuristic Rules

25 regex-based patterns in `threats/prompt-injection.yaml` covering:

- **Instruction override** — "ignore previous instructions", "forget your rules", "disregard all directives"
- **Role/persona override** — "you are now DAN", "developer mode enabled", "act as admin"
- **Security bypass** — "bypass safety", "disable security", "skip security checks"
- **Anti-transparency** — "do not tell the user", "do not inform the operator"
- **Prompt exfiltration** — "reveal your system prompt", "show me your instructions", "repeat everything"
- **Structural injection** — hidden instructions in HTML comments, markdown links
- **Role marker injection** — fake `Human:`/`Assistant:` conversation turns, `[INST]` tags
- **Encoding/obfuscation** — leetspeak variants (`1gn0r3`, `byp4ss`)
- **Credential exfiltration** — piping dotfiles to curl, requests to dump environment variables

Heuristic rules run in ~0.001ms and are always active (controlled by `heuristics_enabled` config). They can be individually disabled via `disabled_threats`.

### Tier 2: ML Model

A machine learning model that catches subtle and rephrased injection attacks that regex patterns miss. The model:

- Outputs a risk score between 0 and 1
- Handles content up to `max_content_length` (default 16KB), sampling 80% from head and 20% from tail for longer inputs
- Adds ~17ms latency for short content, up to ~142ms for 16KB
- Is trained on specific content types: Python, JavaScript, TypeScript, shell, HTML, JSON, text, CSV, XML, C, C++, YAML, Kotlin

The two tiers are independent:

- **Tier 1 (heuristics)** is gated by `heuristics_enabled` (default `true`) and runs without any model on disk.
- **Tier 2 (ML)** is gated by `pi_check.enabled` (default `false`). Disabling `pi_check.enabled` does **not** disable Tier 1.

ML detection is **disabled by default**. Enable it in `~/.sage/config.json`:

```json
{
  "pi_check": {
    "enabled": true
  }
}
```

#### First-run download

The ML model is not bundled with Sage. The first time you start a Sage-managed session with `pi_check.enabled = true`, a background worker fetches the model and unpacks it under:

```
~/.sage/models/<schema>/
```

The schema tag (currently `v1`) is bumped only when the model layout changes; Sage upgrades that don't change the model reuse the already-downloaded files. Files are downloaded over HTTPS and verified with a SHA-256 checksum before they replace the cached copy.

Before the download finishes, ML inference is **skipped** for that session — heuristics still run. The model is picked up on the next session start.

For air-gapped installs (or to pin a specific model), set `pi_check.model_path` to an absolute directory containing the model files; this disables the download entirely.

### How the Tiers Work Together

At PreToolUse, heuristic rules run on all tools. If heuristics detect a blocking match, the ML model is skipped. For WebFetch, the ML model runs only when heuristics don't match and no other signal (URL check, cache) already denies the request.

At PostToolUse, only heuristic rules scan tool output. The ML model does not run at PostToolUse.

## ML Model Scope

The ML classifier runs **only on WebFetch** at PreToolUse. Sage pre-fetches the URL content before the agent's tool call, runs the classifier, and decides:

- **High risk (>= 0.99):** hard deny — blocks the WebFetch before the agent sees the content
- **Medium risk (>= 0.5, < 0.99):** allow with warning — the tool call proceeds but a warning is injected via PostToolUse
- **Low risk (< 0.5):** allow — no action

### Content type filtering

The ML model is trained on specific content types. To avoid feeding it content it cannot meaningfully classify, Sage filters URLs in two stages:

1. **Extension allowlist** — URLs with recognized extensions (`.py`, `.js`, `.ts`, `.sh`, `.html`, `.json`, `.txt`, `.csv`, `.xml`, `.c`, `.cpp`, `.yaml`, `.kt`, and variants) are fetched and scanned. URLs with non-scannable extensions (`.md`, `.pdf`, `.png`, `.toml`, etc.) are skipped entirely without fetching.

2. **Content sniffing fallback** — URLs without file extensions (e.g., API endpoints, HTML pages) are fetched and the first 4KB is tested against regex patterns for HTML, JSON, XML, YAML, shell shebangs, Python, JavaScript, C/C++, Kotlin, and CSV. Only content matching a recognized pattern is scanned.

### Pre-fetch behavior

- Sage fetches URLs with a 4-second timeout and a `sage` User-Agent
- Response size is stream-limited to `max_content_length` (default 16KB)
- Content-Type header is checked; non-textual responses (images, binaries) are skipped
- If the pre-fetch fails for any reason, the tool call is allowed (fail-open)

## Thresholds

| Score | Verdict | Meaning |
|-------|---------|---------|
| >= 0.99 | `deny` | High risk — likely injection. WebFetch blocked, agent never sees the content |
| >= 0.5 | `allow` + warn | Medium risk — tool call proceeds, warning injected via PostToolUse. Suppressed under `sensitivity = "relaxed"`. |
| < 0.5 | `allow` | Clean content |

Thresholds are configurable via `pi_check.high_risk_threshold` and `pi_check.medium_risk_threshold` in config. The defaults are tuned for the bundled model and should not need adjustment.

Setting `sensitivity = "relaxed"` suppresses the entire medium band — no warnings are injected for medium-risk PI detections. High-risk denies and all heuristic prompt-injection rules are unaffected.

## What It Detects

The model is trained on prompt injection data and detects:

- Instruction override and manipulation ("ignore/forget/disregard previous instructions")
- Goal hijacking ("ATTENTION: you MUST click this link")
- Persona/role override ("you are now DAN", "HACKGPT")
- System/admin marker abuse ("[SYSTEM] override security")
- Turn injection (fake `Human:`/`Assistant:` conversation turns)
- HTML comment hiding (`<!-- hidden instruction -->`)
- Jailbreak and developer mode patterns
- Multilingual injection (German, French, Spanish)

## Platform Behavior

### Heuristic rules (Tier 1)

| Platform | PreToolUse | PostToolUse |
|----------|-----------|-------------|
| Claude Code | All tools → **block** | Read/Bash/WebFetch output → **warn** |
| Cursor | Write/Edit/Shell/Read content → **block** | Read/Shell/WebFetch output → **warn** |
| VS Code | Bash/Write/Edit content → **block** | Not supported (PostToolUse output is [ignored by the platform](https://docs.github.com/en/copilot/reference/hooks-configuration)) |
| OpenClaw | All tools → **block** or **require approval** | Not supported (no PostToolUse phase) |

### ML model (Tier 2)

| Platform | PreToolUse | PostToolUse medium-risk warning |
|----------|-----------|-------------------------------|
| Claude Code | WebFetch → pre-fetch + scan → **block** if high risk | Yes — injected via `additionalContext` |
| Cursor | WebFetch → pre-fetch + scan → **block** if high risk | Yes — injected via `additional_context` |
| VS Code | WebFetch → pre-fetch + scan → **block** if high risk | No — PostToolUse output [ignored by platform](https://docs.github.com/en/copilot/reference/hooks-configuration) |
| OpenClaw | WebFetch → pre-fetch + scan → **block** if high risk | No — no PostToolUse phase |

## Dependencies

The ML model itself ships as a downloadable archive (see "First-run download" above) — it is not bundled with Sage in any connector. Once the model is on disk, Sage lazily installs the model runtime into the model directory the first time it runs inference. That install is ~30MB; no global state is touched.

| Connector | Model archive | Model runtime |
|-----------|---------------|---------------|
| Claude Code, Cursor, VS Code, OpenClaw, OpenCode | Downloaded into `~/.sage/models/` at session start when `pi_check.enabled = true` | Installed lazily into the same model directory on first inference |

If the network is unreachable or the download is in progress, ML inference is silently skipped (Tier 1 heuristics still run). The model has no external dependencies beyond its runtime.

## Telemetry and False Positive Reporting

All prompt injection detections — both PreToolUse blocks and PostToolUse warnings — are logged to the audit log (`~/.sage/audit.jsonl`) with ML-specific signal data including risk score, model identifier, and content context. Medium-risk allow verdicts are also logged when PI signals are present.

Detection telemetry is sent to the Sage backend (Community IQ) for aggregate threat intelligence, following the same pipeline as other detection types (URL checks, heuristics).

**False positive reporting** works via the existing MCP tools:

1. User tells the agent a detection was wrong
2. Agent calls `sage_list_audit_entries` to find the entry
3. Agent calls `sage_report_false_positive` with the entry ID and reasoning
4. Report is sent to Sage Proxy with ML signal metadata (risk score, model ID)

This works for both PreToolUse (deny verdicts) and PostToolUse (warning verdicts) since both produce audit log entries.

## Known Limitations

- **Double fetch (TOCTOU):** Sage pre-fetches the URL, then the agent fetches it again. A malicious server could serve different content to each request based on User-Agent, timing, or request count.
- **Medium-risk warnings require audit logging:** The medium-risk warning path uses the audit log as a state channel between PreToolUse and PostToolUse. If audit logging is disabled (`logging.enabled: false`), medium-risk warnings are silently lost. High-risk denies are unaffected.
- **VS Code PostToolUse:** VS Code Copilot Chat does not support PostToolUse output modification. Medium-risk warnings cannot be surfaced on this platform.
- **Single-URL PI scan:** When a tool provides multiple URLs (e.g. VS Code `fetch_webpage`), only the first URL is PI-scanned. Scanning all URLs would multiply pre-fetch latency and risk exceeding hook timeouts.
- **Bash bypass:** An agent denied a WebFetch could use `curl` via Bash to access the same URL. Heuristic rules provide partial coverage for this case.

## Configuration Reference

```json
{
  "pi_check": {
    "enabled": false,
    "max_content_length": 16384,
    "model_path": "/custom/path/to/model",
    "high_risk_threshold": 0.99,
    "medium_risk_threshold": 0.5
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | `false` | Enable ML-based prompt injection detection. Triggers a one-time background model download on the next session start. Tier 1 heuristic rules are unaffected by this flag. |
| `max_content_length` | `16384` | Max content to scan (chars). Longer content is sampled from head (80%) + tail (20%). Also limits the pre-fetch response size. |
| `model_path` | auto | Absolute path to a model directory. When set, the auto-download is bypassed entirely (use this for air-gapped installs). When unset, the model is resolved from `~/.sage/models/`. |
| `high_risk_threshold` | `0.99` | Risk score for `deny` verdict (hard block) |
| `medium_risk_threshold` | `0.5` | Risk score for medium-risk warning (allow with warning injected via PostToolUse) |

## Accuracy Benchmark

Run a manual evaluation of the cached model against three labeled fixtures:

```bash
pnpm eval:pi
```

The benchmark resolves the model from `~/.sage/models/` (the same path the runtime uses). If the model directory is missing or incomplete, the script exits non-zero with the list of missing files. If the model runtime is not yet installed under that directory's `node_modules/`, the first run will install it (one-time setup; subsequent runs reuse the same install).

The benchmark loads:

- **`pi-benign-50.json`** — 50 benign samples (code, docs, configs, HTML, prose, plus adversarial benigns like CTF writeups, pentest reports, and security documentation that legitimately mention "ignore", "override", or "system prompt")
- **`pi-injection-50.json`** — 50 synthetic injection samples spanning instruction override, goal hijacking, persona jailbreak, structural injection, role-marker injection, encoding/obfuscation, and credential exfiltration techniques
- **`pi-ioc-snippets.json`** — 10 short text snippets extracted verbatim from public real-world IOCs in [Unit 42's IDPI research](https://unit42.paloaltonetworks.com/ai-agent-prompt-injection/), with malicious URLs sanitized to `example.com` placeholders

Output is a per-suite breakdown of deny / ask / miss verdicts, plus per-category and per-technique slices and the first few misclassified items. The benchmark is pure observability — no assertions, no thresholds — and is intentionally excluded from `pnpm test` so model swaps and threshold tuning don't break CI on numerical drift. Use it as a sanity check whenever you replace the model or adjust thresholds.

Fixtures live in `packages/core/src/__tests__/fixtures/`; the script lives in `packages/core/scripts/eval-pi-accuracy.mjs`.
