# @gendigital/sage-mcp

## 0.11.0

### Minor Changes

- Add 13 threat rules from [ATR (Agent Threat Rules)](https://github.com/Agent-Threat-Rule/agent-threat-rules) under MIT (ATR project). In `prompt-injection.yaml`: 4 rules (CLT-PI-052 MCP IMPORTANT-tag shadowing, CLT-PI-091 HTML-comment delivery, CLT-PI-092 jailbreak persona, CLT-PI-093 CJK pivot). In `agent-layer.yaml`: 9 rules covering MCP path traversal (CLT-MCP-004), skill-package compromise (CLT-SKL-001/002/004/005/006/008: mandatory override, base64 payload, hidden comment exfil, Unicode Tag smuggling, compound archival exfil, auto-approve rider), PEM key leak (CLT-CTX-003), and MCP filesystem typosquatting (CLT-SUPPLY-002). All rules match `content` artifacts (Write/Edit content and plugin/skill file scans).

### Patch Changes

- Updated dependencies:
  - Updated dependency `@gendigital/sage-core` to `0.11.0`

## 0.10.0

### Minor Changes

- Add configurable operational JSONL logging for Sage runtimes. Emit structured diagnostics from core evaluation, telemetry, hooks, MCP servers, and connector startup paths into `~/.sage/operational.jsonl`, with level filtering and rotation alongside the existing audit log behavior.

### Patch Changes

- Updated dependencies:
  - Updated dependency `@gendigital/sage-core` to `0.10.0`

## 0.9.0

### Minor Changes

- Bundle brand definitions internally and resolve via `config.brand_key`. Replaces `product_name`/`banner_text` with `name` (full) and `short_name` (for space-constrained notification bubbles).
- improve audit log and telemetry to produce accurate data for verdict tracking and reporting issues

### Patch Changes

- Updated dependencies
  - @gendigital/sage-core@0.9.0

## 0.8.0

### Minor Changes

- Add white-label branding support. Product name, banner text, and extension command palette entries are configurable per installation via ~/.sage/branding.json.

### Patch Changes

- Updated dependencies
  - @gendigital/sage-core@0.8.0

## 0.7.0

### Minor Changes

- Align version with core and other packages

### Patch Changes

- Updated dependencies [6e5d727]
- Updated dependencies [dd59f18]
- Updated dependencies [a3d7167]
- Updated dependencies [693ac93]
- Updated dependencies [069166d]
  - @gendigital/sage-core@0.7.0
