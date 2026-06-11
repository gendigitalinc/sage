# Interoperability with ATR (Agent Threat Rules)

This document explains how Sage's threat rules interoperate with the upstream
ATR project. The integration is opt-in. Sage maintainers retain full
editorial control. Nothing in this document grants ATR or its contributors
any decision-making authority over Sage's `threats/` content.

## What ATR is

ATR (Agent Threat Rules) is an MIT-licensed open detection rule corpus for
AI agent attacks, at https://github.com/Agent-Threat-Rule/agent-threat-rules.
It uses a multi-condition YAML schema; many ATR rules have 5-10 detection
conditions per rule, each with its own regex.

Sage's `threats/*.yaml` schema is single-pattern-per-rule. A given ATR rule
may map to 1 to N Sage rules after schema translation.

## The bridge

The `agent-threat-rules` npm package exposes a converter at the subpath
`agent-threat-rules/converters/sage`. Given an ATR rule, the converter
produces one or more Sage-schema rules. The converter is published from
ATR's main repo, licensed MIT.

What the converter handles:

- Schema field mapping (ATR `tags.category` → Sage `category`, ATR `severity`
  → Sage `severity`, ATR `response.actions` → Sage `action`, etc.).
- Field-target collapse: ATR's `user_input`, `agent_output`, `content`,
  `tool_response`, `tool_args`, `tool_name`, `tool_description` all collapse
  to Sage's single `content` match_on channel.
- Multi-condition handling: when an ATR rule's conditions produce a
  combined regex over 500 characters, the converter splits into N Sage
  rules (CLT-XXX-Na, CLT-XXX-Nb, etc.) so each rule's regex stays
  readable and debuggable.
- Inline regex flag extraction: `(?i)` PCRE inline flag becomes Sage's
  rule-level `case_insensitive: true`. Unsupported inline flags are
  stripped with a warning.
- Action calibration: when ATR action is `block` but ATR confidence is
  below 0.85, the converter downgrades the Sage action to `require_approval`
  to match Sage's existing convention of requiring high confidence for
  block-level actions.

What the converter does NOT handle (skips with a warning):

- ATR `detection_tier: semantic` rules (require LLM evaluation, not regex).
- ATR `detection_tier: behavioral` or `protocol` rules (metric thresholds
  or sequence detection — Sage's runtime is regex-only).
- ATR `status: deprecated` rules.
- ATR `response.actions: reset_context` or `reduce_permissions` (no Sage
  equivalent; these actions are dropped with a warning).

## What the bridge guarantees

The bridge guarantees:

1. Generated rules pass Sage's threat-loader schema (id, category, severity,
   confidence, action, pattern, match_on, title — all present).
2. Every generated rule's pattern compiles under JavaScript's `RegExp`
   engine (the same engine Sage uses at runtime).
3. Every generated rule carries provenance: a `# Upstream:` comment
   referencing the ATR rule id and a hyperlink to the source.
4. License attribution is preserved: each rule comment notes the
   ATR upstream's MIT license and the DRL 1.1 license that applies once the
   rule is part of Sage's `threats/`.

The bridge does NOT guarantee:

- That a generated rule's false-positive rate on Sage's specific user base
  matches the FP rate it had against ATR's benign corpus. Sage's user base
  is different.
- That every condition in an ATR rule survives the conversion. Some
  conditions (semantic tier, behavioral, deprecated) are dropped.
- That ATR's compliance metadata (eu_ai_act, nist_ai_rmf, iso_42001,
  references.mitre_atlas, etc.) survives. Sage's schema has no fields for
  these. They survive only as a hyperlink to the upstream ATR rule, where
  the full metadata can be inspected.

## How Sage maintainers stay in control

The sync is OPT-IN and entirely manual. No workflow runs in CI and no auto-
merge ever happens. Specifically:

1. `scripts/sync-with-atr.ts` writes to a separate file
   `threats/agent-layer.atr-generated.yaml`, NOT directly to
   `threats/agent-layer.yaml`. Sage maintainers manually copy desired
   entries into the production file.
2. There is no automated sync workflow. A maintainer runs the script
   locally and opens a pull request by hand, so a human reviews every
   proposed change before it lands.
3. `threats/.atr-bridge-config.yaml` controls every aspect:
   - `enabled: false` (the default) makes the script a no-op.
   - `include_ids: []` is the only ATR ids the script will sync. New ids
     added to upstream do NOT auto-flow until they appear here.
   - `exclude_ids: [...]` lets a maintainer permanently block a specific
     ATR rule from sync, with a comment for posterity.
   - `manual_overrides: [...]` lets a maintainer edit a rule in
     `threats/agent-layer.yaml` and ensure subsequent sync runs skip it.

## When to use this bridge vs manual port

Use the bridge when:

- A new ATR rule has clean single-condition or low-complexity multi-
  condition structure.
- Sage's existing schema accepts the regex without modification.
- The Sage maintainer trusts ATR's benign-corpus validation (the rule has
  `wild_fp_rate: 0` on ATR's 432-sample benign corpus).

Manually port (don't use the bridge) when:

- The ATR rule is semantic or behavioral tier (the bridge can't handle).
- Sage wants a different regex narrowing or tightening than ATR's source
  provides.
- The rule needs Sage-specific test cases or false-positive suppression
  that the bridge can't generate.

## Bidirectional possibility

A reverse converter (`agent-threat-rules/converters/sage-reverse`) exists
for Sage maintainers who want to contribute rules they've authored
in Sage's format back to the ATR community. The reverse path emits a YAML
rule with placeholder fields for description, test cases, and compliance
metadata that the contributor must fill in before submitting an ATR PR.

This reverse path is optional and not required for the basic bridge to
function.

## License

Bridge code: MIT (per ATR's repo license).
ATR rules: MIT.
Sage rules (this repo): Detection Rule License 1.1.

When an ATR rule is converted to Sage's schema and lands in
`threats/agent-layer.yaml`, it becomes subject to DRL 1.1 by file
convention, with the upstream MIT attribution preserved in the per-rule
comment as required by both licenses.
