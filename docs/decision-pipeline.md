# Decision Pipeline

Single authoritative reference for developers working on Sage's detection logic. Covers signal sources, policy model, evaluation order, and the contract for adding new sources.

---

## Vocabulary

| Term | Values | Notes |
|------|--------|-------|
| **Decision** | `allow`, `ask`, `deny` | Final per-tool-call verdict |
| **Severity** | `info`, `warning`, `critical` | User-facing urgency; independent of decision |
| **Sensitivity** | `paranoid`, `balanced`, `relaxed` | User-configured; shifts policy thresholds |
| **Confidence** | `(0.0, 1.0]` | Single number produced by each signal source |

---

## Policy Model

Classification is separated from enforcement. Signal sources emit `(confidence, category)`. The policy engine derives the decision from confidence alone.

```ts
// packages/core/src/policy.ts
function applyPolicy(confidence, denyThreshold, askThreshold, logger): Decision {
  if (!Number.isFinite(confidence) || confidence <= 0 || confidence > 1) {
    logger.warn("Invalid confidence; treating as allow", { confidence })
    return "allow"          // fail-open: log + skip when confidence is out of range
  }
  if (confidence >= denyThreshold) return "deny"
  if (confidence >= askThreshold)  return "ask"
  return "allow"
}
```

**Threshold table** (`SENSITIVITY_POLICY` in `policy.ts`):

| Sensitivity | `denyThreshold` | `askThreshold` |
|-------------|----------------|---------------|
| `paranoid`  | 0.70           | 0.30          |
| `balanced`  | 0.85           | 0.50          |
| `relaxed`   | 0.95           | 0.70          |

The `balanced` preset is the default.

---

## Signal Sources

Each source produces zero or more signals. A signal carries `(confidence, category, severity, source, reason, artifact)`. Clean outcomes are discarded before the merge: for heuristics, `applyPolicy` is called per match and results that resolve to `allow` are filtered out; for other sources (URL, package, AMSI, PI), only non-clean results are emitted as signals in the first place.

### Heuristic Rules

Source label: `"heuristic"`. Defined in YAML threat files in `threats/`.

- **Confidence**: set by the threat rule author in the `confidence` field (required, must be in `(0, 1]`).
- **Severity**: set by the threat author using the 3-level scale (`critical`, `warning`, `info`). Passed through directly — no mapping.
- **Trusted domain suppression**: rules `CLT-CMD-001`, `CLT-CMD-002`, `CLT-SUPPLY-001`, and `CLT-SUPPLY-004` are suppressed when the matched substring exclusively references domains in `trusted-domains/`. See `heuristics.ts`.
- **PI rules skipped for local markdown**: when the tool is `Write` or `Edit` and the file path ends in `.md/.mdx/.markdown/.mdown/.mkdn`, the `prompt_injection` category is filtered out before matching.
- **Deobfuscated variants**: after the raw match, `HeuristicsEngine.matchDeobfuscated()` scans deobfuscated variants (leet, letter spacing, zero-width characters, base64, hex) of `content` artifacts against the `prompt_injection` rules only. A rule the raw text already tripped is not reported twice, a variant match stays attributed to the original artifact, and the filters above (`disabled_threats`, local markdown) apply because the engine is built from the already-filtered rules. See [Deobfuscation](prompt-injection.md#deobfuscation).

### URL Check

Source label: `"url_check"`. HTTP reputation check against the configured URL reputation API (`clients/url-check.ts`).

| Outcome | Confidence | Severity | Category |
|---------|-----------|----------|----------|
| Malicious | 1.0 | `critical` | `network_egress` |
| Clean | _(no signal)_ | — | — |

URL check results are cached with configurable TTLs (see **Verdict Cache** below).

### Package Check

Source label: `"package_check"`. Registry lookup + file hash reputation (`package-checker.ts`, `clients/package-registry.ts`).

| Verdict | Confidence | Severity | Category |
|---------|-----------|----------|----------|
| `malicious` | 1.0 | `critical` | `supply_chain` |
| `not_found` | 0.95 | `critical` | `supply_chain` |
| `suspicious_age` | 0.60 | `warning` | `supply_chain` |
| `unknown` | 0.60 | `warning` | `supply_chain` |
| `clean` | _(no signal)_ | — | — |

Scoped packages (name starts with `@`) are skipped entirely. The `suspicious_age` threshold is < 7 days since first publish.

### AMSI (Windows only)

Source label: `"amsi"`. Win32 Antimalware Scan Interface via PowerShell P/Invoke (`clients/amsi.ts`); koffi FFI is used instead when available (optional dep, not present in distributed binaries). Only runs when `config.amsi_check.enabled` and `isAmsiSupported()` returns true.

| Outcome | Confidence | Severity | Category |
|---------|-----------|----------|----------|
| Detected (`amsiResult >= 0x8000`) | 1.0 | `critical` | `malware` |
| Blocked by admin (`0x4000 ≤ amsiResult < 0x8000`) | 0.90 | `critical` | `malware` |
| Not detected | _(no signal)_ | — | — |

Scanned tools: `Bash` (command), `Write` (file content), `Edit` (new_string), `ApplyPatch` (patch).

### Prompt Injection (ML Model)

Source label: `"pi_check"`. Bundled ONNX binary classifier (`clients/pi-check.ts`). **PreToolUse only, `WebFetch` tool only.**

| Risk level | Condition (default thresholds) | Confidence | Severity | Category |
|------------|-------------------------------|-----------|----------|----------|
| High | `risk >= 0.99` | 1.0 | `critical` | `prompt_injection` |
| Medium | `0.5 ≤ risk < 0.99` | 0.60 | `warning` | `prompt_injection` |
| Below medium | `risk < 0.5` | _(no signal)_ | — | — |

These thresholds are fixed constants (`0.99` / `0.5`). Medium-risk results that don't reach the decision threshold are attached to the verdict as `piWarnings` (when sensitivity is not `relaxed`) for informational display — they do not influence the decision.

**Suspicious-band telemetry (observability only).** PI results scoring in the band `[0.95, 0.99)` on a non-`deny` verdict emit a non-blocking event to `/v2/heuristic`, gated on `config.community_iq`. This never changes the decision.

PI hits (`risk >= 0.5`) are reported as `Text:OnlineClassifier [Misc]|<model version>-<text hash>|sgpi`, unique per model version and highest-risk chunk. Lower scores append the engine shorthand, model ID, model schema, and common Sage suffix to the stable canonical name: `Other:SagePromptInjectionML-A [Susp]|sgml:pi-model:v2|sage`. User-facing notifications keep the unsuffixed canonical name. The raw `risk` score and model ID also remain in separate metadata fields for debugging and model rollout analysis.

---

## Source Calibration Table

Decision under each sensitivity preset for every non-heuristic source outcome:

| Source | Outcome | Confidence | Paranoid | Balanced | Relaxed |
|--------|---------|-----------|----------|----------|---------|
| URL check | malicious | 1.00 | deny | deny | deny |
| Package | malicious | 1.00 | deny | deny | deny |
| Package | not_found | 0.95 | deny | deny | deny |
| AMSI | detected | 1.00 | deny | deny | deny |
| PI | high-risk | 1.00 | deny | deny | deny |
| AMSI | blocked_by_admin | 0.90 | deny | deny | **ask** |
| Package | suspicious_age | 0.60 | ask | ask | **allow** |
| Package | unknown | 0.60 | ask | ask | **allow** |
| PI | medium-risk | 0.60 | ask | ask | **allow** |

Heuristic rules: decision depends on the author-set `confidence` value and the active sensitivity.

---

## Multi-Signal Merge

When multiple signals fire, the engine takes the **maximum confidence** and applies thresholds to that single value:

```
top = max(signals, by confidence)
decision = applyPolicy(top.confidence, denyThreshold, askThreshold)
```

The top signal's `category`, `severity`, `source`, and `threatId` are used in the verdict. **All** signals contribute their `artifact` and `reason` to the verdict lists (insertion-order deduplicated). If multiple signals tie on confidence, the first one wins (stable `reduce`).

---

## Flags

Threat rules carry an optional `flags: string[]` field (default `[]`), loaded by `threat-loader.ts` and stored on the `Threat` object. Defined values:

| Flag | Behavior |
|------|----------|
| `"submit_only"` | Hunting / canary rule. `DecisionEngine` skips its matches, so it never contributes a `deny`/`ask` signal. When a bundled rule matches on a non-`deny` verdict and `community_iq` is enabled, the evaluator sends a non-blocking Community IQ event (`blocking: false` → `/v2/heuristic`, `verdict: "suspicious"`), subject to the per-rule submit cap below. Custom-rule signals are omitted; a custom-only event is not submitted, while co-occurring non-custom detections can still be submitted. Helper: `isSubmitOnlyThreat()`. |

### Per-rule submit cap

`submit-limits.ts` keeps `~/.sage/submit-limits.json` (rule id → epoch ms of the last submission) and allows at most one submission per submit-only rule per client per 24h (`SUBMIT_WINDOW_MS`). `claimRuleSubmissions()` checks and records under a file lock with an atomic write before telemetry is sent. A missing or corrupt file reads as empty; if the claim cannot be persisted the submission is suppressed (so a broad rule can't flood telemetry). Nothing on this path throws or affects the verdict. Capped submit-only rules are stripped from `signals.heuristics` of any other non-blocking event (e.g. a PI suspicious-band hit) so they are not re-reported. Blocking `deny` telemetry to `/v2/detection` is never capped.

---

## PreToolUse Evaluation Order

Implemented in `evaluateToolCall` (`packages/core/src/evaluator.ts`). All error paths are **fail-open** unless noted otherwise.

| Step | What happens |
|------|-------------|
| **1. Load config** | Reads `~/.sage/config.json` (or `context.configPath`). Falls back to default config on error. |
| **2. Early exit** | If `artifacts.length === 0` and `config.pi_check.enabled === false`, returns `allow("no_artifacts")` immediately. |
| **3. Deny exceptions** | Loads `~/.sage/exceptions.json`, calls `findDenyException`. If any deny rule matches any artifact, returns `deny` immediately and writes the audit log. Fails open. |
| **4. Allow exceptions** | Calls `findAllowException` on the same loaded exceptions. Match semantics are type-aware: `domain` rules apply only when ALL artifacts are URLs and every URL must match at least one domain rule (intentional — prevents a trusted domain from bypassing unrelated command threats in mixed-artifact evaluations); `path`/`executable` rules short-circuit on any match; `regex` rules require ALL artifacts to each match at least one regex rule. Returns `allow("exception")` with `userOverride: true` in the audit log. Fails open. |
| **5. Cache init** | Creates `VerdictCache` and loads from disk. If this fails, cache is `null` for the rest of the pipeline (all sources are checked live). |
| **6. URL cache partition** | Splits URL artifacts into `cachedUrlVerdicts` (hit in cache) and `uncachedUrls` (to be checked live). |
| **7. Heuristic matching** | If `config.heuristics_enabled`: loads threats, filters out `config.disabled_threats`, filters out PI rules for local markdown writes, loads trusted domains, runs `HeuristicsEngine.match()`, then `matchDeobfuscated()` for prompt-injection variants. |
| **8. URL check** | URLs to check are `uncachedUrls` when cache loaded successfully, or all URL artifacts when cache is unavailable. If any remain and `config.url_check.enabled`: calls `UrlCheckClient.checkUrls()`. Fails open. |
| **9. Package check** | If `config.package_check.enabled`: extracts packages from `Bash` commands or `Write`/`Edit` manifests, checks cache, queries `PackageChecker` for uncached packages. |
| **10. AMSI scan** | Windows only. Scans `Bash`, `Write`, `Edit`, `ApplyPatch` tool input. Fails open. |
| **11. Preliminary verdict** | Calls `engine.decide({heuristics, url, package, amsi})` — PI signals are excluded here. If the result is `deny`, the expensive PI check is skipped. |
| **12. PI check** | Only runs if: `config.pi_check.enabled`, tool is `WebFetch`, preliminary verdict is not `deny`, and no cached URL verdict is `deny`. Fetches URL content via `ContentFetchClient`, filters non-scannable extensions, runs `BundledPiProvider.checkContent()`. Fails open. |
| **13. Final verdict** | If PI results exist: re-runs `engine.decide()` with all signals including PI. Otherwise uses the preliminary verdict. |
| **14. Cached URL override** | If final verdict is `allow` but `cachedUrlVerdicts` contains a non-allow entry, overrides the verdict with the cached deny/ask. |
| **15. Cache URL results** | Persists new URL check results to the verdict cache. |
| **16. Audit signal assembly** | Builds the `AuditSignals` object (`heuristics`, `url_checks`, `file_checks`, `package_checks`, `pi_checks`, `amsi_checks`). Only non-clean signals are included. |
| **17. Audit logging** | Calls `logVerdict()`. `allow` verdicts are skipped unless `config.log_clean`, `userOverride`, or `AuditSignals` is non-empty. Fails open. |
| **18. Detection telemetry** | `deny` verdicts call `sendCommunityIqTelemetry()` → `/v2/detection` (blocking event). Otherwise, PI results in the suspicious band (`[0.95, 0.99)`) or a `submit_only` rule match that claims a submit slot (see [Flags](#flags)) send a single non-blocking event → `/v2/heuristic`. Both gated on `config.community_iq`. Fails open. |
| **19. Session status update** | Non-`allow` verdicts: calls `updateSessionStatus()` to update the Claude Code status line. Fails open. |
| **20. PI warnings attachment** | Medium-risk PI results (`mediumRisk ≤ risk < highRisk`) are attached to `verdict.piWarnings` when sensitivity is not `relaxed`. These are informational only — the verdict decision is already set. |

---

## PostToolUse Output Scanning

Implemented in `evaluateToolOutput` (`packages/core/src/evaluator.ts`). A separate flow from PreToolUse.

**Key differences from PreToolUse:**
- **Cannot block.** Returns `ToolOutputWarning[]` injected as `additionalContext`. The agent sees the warning but the tool output is not suppressed.
- **Heuristic PI rules only.** Only `category === "prompt_injection"` threats are matched against output content, including deobfuscated variants (the warning notes how a hidden injection was found, e.g. `[after decoding: base64]`; when the raw text and a variant both match, the raw match is reported). No ML model, no URL/package/AMSI checks.
- **No exceptions or cache.** Every tool output is scanned live.

**Scanned tools and content extracted:**

| Tool | Content scanned |
|------|----------------|
| `Read` | `tool_response.content` |
| `Bash` / `Shell` | `tool_response.stdout` (CC) or `tool_output.output` (Cursor) |
| `WebFetch` | `tool_response.result` (CC) or `tool_output.content` (Cursor) |

Detections are audit-logged (as `hookType: "PostToolUse"`) and reported to the detection telemetry endpoint. Both fail open.

---

## Plugin Scanning

At session start, Sage scans installed plugins for threat indicators via `session-start.ts`. This is an advisory-only pipeline: findings are reported to the user as a warning banner but **cannot block plugin loading**. It uses its own finding type (`PluginFinding`) and a separate `PluginScanCache`. See [`docs/plugin-scanning.md`](plugin-scanning.md) for details.

---

## Audit Logging

Implemented in `packages/core/src/audit-log.ts`.

- **Format**: UTF-8 JSONL (`~/.sage/audit.jsonl`), one entry per line, append-only.
- **Schema version**: `1` (stamped by `appendEntry`, callers cannot override).
- **Entry types**: `runtime_verdict` (per tool-call evaluation), `plugin_scan` (session-start scan).
- **Filtering**: `allow` verdicts are not logged unless `config.log_clean: true`, `userOverride: true`, or the `AuditSignals` object is non-empty (i.e., at least one heuristic match, URL detection, or other signal was recorded).
- **Rotation**: cross-process directory-locked. Default: 5 MiB max, 3 files (`audit.jsonl` → `audit.jsonl.1` → `audit.jsonl.2`). Configurable via `config.logging.max_bytes` and `config.logging.max_files`.
- **Content snapshot**: the `content` field is built by `buildContentSnapshot()` (`content-snapshot.ts`). Fields vary by tool type (e.g., `command` for Bash, `url` for WebFetch, `file_path` for file tools). Home paths are scrubbed (`~` substitution). Omitted entirely for tools with no extractable content.

See [`docs/audit-log.md`](audit-log.md) for the full schema, field definitions, and example entries.

---

## Verdict Cache

Implemented in `packages/core/src/cache.ts`. Checked after exceptions (step 5–6) and written after URL check (step 15).

**TTL by store:**

| Store | Condition | TTL |
|-------|-----------|-----|
| URL (malicious) | `isMalicious: true` | `config.cache.ttl_malicious_seconds` |
| URL (clean) | `isMalicious: false` | `config.cache.ttl_clean_seconds` |
| Package (deny) | `verdict: "deny"` | 24 hours |
| Package (allow, fresh) | `verdict: "allow"`, age < 7 days | 1 hour |
| Package (allow, mature) | `verdict: "allow"`, age ≥ 7 days | 24 hours |

Cache entries are invalidated on Sage version mismatch (stale entries from a previous version are discarded on next load).

---

## Contract for New Sources

When adding a new signal source:

1. **Produce `(confidence, category, severity, source, reason, artifact)`.** Confidence must be in `(0, 1]`. `applyPolicy` enforces this as defense-in-depth: out-of-range values are logged and treated as `allow` (fail-open). Source authors should still validate at the boundary — the policy log is a last-line backstop, not a primary error channel.

2. **Calibrate confidence to the right policy zone.** The zones are defined by the threshold table:

   | Zone | Confidence range | Behavior |
   |------|-----------------|----------|
   | Always deny | ≥ 0.95 | deny under all sensitivities |
   | Deny paranoid/balanced, ask relaxed | [0.85, 0.95) | |
   | Deny paranoid, ask balanced/relaxed | [0.70, 0.85) | |
   | Ask paranoid/balanced, allow relaxed | [0.50, 0.70) | |
   | Ask paranoid, allow balanced/relaxed | [0.30, 0.50) | |
   | Always allow | < 0.30 | signal is discarded |

3. **If the confidence is not calibrated** (e.g., raw model score), pick a fixed value that lands in the correct zone and document which zone and why. See PI medium-risk (0.60) as a reference: it lands in "ask paranoid/balanced, allow relaxed" by design.

4. **Add to `collectSignals` in `engine.ts`** and extend `SignalSources` in `types.ts`. Add audit signal assembly in `evaluateToolCall` in `evaluator.ts`.

5. **Write golden-file and boundary tests.** The golden-file fixture (`packages/core/src/__tests__/fixtures/`) is the regression gate for behavioral changes across sensitivities.
