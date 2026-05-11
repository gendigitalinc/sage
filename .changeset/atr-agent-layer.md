---
"@gendigital/sage-core": minor
"@gendigital/sage-claude-code": minor
"@gendigital/sage-openclaw": minor
"@gendigital/sage-opencode": minor
"@gendigital/sage-mcp": minor
"sage-cursor": minor
---

Add `threats/agent-layer.yaml` — 17 agent-layer threat rules covering prompt injection, MCP tool poisoning, skill-package compromise, and context exfiltration. Contributed upstream from [ATR (Agent Threat Rules)](https://github.com/Agent-Threat-Rule/agent-threat-rules) under MIT license per issue #30 comment. All rules match `content` artifacts (Write/Edit/plugin scan); zero false positives on 432-sample real-world benign skill corpus.
