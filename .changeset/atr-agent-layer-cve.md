---
"@gendigital/sage-core": patch
---

Add 7 CVE-anchored agent-layer threat rules from ATR (Agent Threat Rules), MIT.

Fills two previously-uncovered slots with attack-only, CVE-backed signatures:

- Privilege escalation (`CLT-PRV-001a..e`) — Microsoft Semantic Kernel SessionsPythonPlugin arbitrary file write + OS startup persistence (CVE-2026-25592): autostart/LaunchAgents/cron.d/systemd write destinations, the SK plugin identifier, file-write calls into autostart paths, and Windows registry Run-key persistence.
- MCP tool poisoning (`CLT-MCP-005..007`) — FastMCP server-name command injection (CVE-2025-64340), MCP STDIO inline-interpreter injection (CVE-2026-40933, Flowise), and PraisonAI `tool_override` RCE sink (CVE-2026-44334).

Each rule matches `content` artifacts, is narrowed to attack-only patterns, and ships with match + benign test cases. No auto-sync workflow.
