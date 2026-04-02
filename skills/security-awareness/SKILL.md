---
name: security-awareness
description: "Security best practices for safe command execution, URL handling, credential management, and supply chain safety. Guidance on avoiding common attack vectors like reverse shells, command injection, and malware distribution."
user-invocable: false
disable-model-invocation: false
---

# Security Awareness

You are working in an environment protected by Sage, a security plugin. Be mindful of these security considerations when executing commands and fetching URLs.

## Remote Code Execution

- **Never pipe untrusted content to a shell** (`curl | bash`, `wget | sh`). Always download first, inspect, then execute.
- Avoid `eval()` on untrusted input in any language.
- Be cautious with `source` or `.` commands on remote scripts.

## Malware Distribution Vectors

- Executables downloaded from the internet (`.exe`, `.msi`, `.bat`, `.ps1`, `.scr`) should be treated as potentially malicious.
- Raw paste sites (pastebin.com/raw, paste.ee/r) are commonly used to host payloads and C2 commands.
- Direct IP address URLs (e.g., `http://192.168.1.1/payload`) may indicate C2 infrastructure.

## Command Injection Patterns

- Watch for reverse shell patterns: `/dev/tcp/`, `nc -e`, `bash -i >& /dev/`.
- Destructive commands like `rm -rf /`, `mkfs`, `dd if=`, and `shred` can cause irreversible data loss.
- Be wary of download-and-execute chains: `curl ... && chmod +x && ./`.

## Supply Chain Security

- Verify package names carefully — typosquatting is common (e.g., `colourama` vs `colorama`).
- Check package popularity and maintenance status before installing.
- Prefer pinned versions over latest/wildcard versions.
- Review post-install scripts when possible.

## Credential Handling

- Never hardcode secrets, API keys, or passwords in source code.
- Use environment variables or secret managers for sensitive values.
- Never commit `.env` files, credentials, or private keys to version control.
- Be cautious with commands that read or transmit sensitive files (`/etc/passwd`, `.ssh/`, `id_rsa`).

## Safe URL Handling

- Prefer HTTPS over HTTP for all external requests.
- Validate URLs before fetching — check the domain is expected.
- Be cautious with URL redirects that might lead to malicious destinations.
- Don't fetch URLs from untrusted sources without verification.

## File Permissions

- Avoid `chmod 777` — use the minimum permissions needed.
- Be cautious with `NOPASSWD` in sudoers configurations.
- Don't create world-writable files or directories in shared locations.

## Sage Flagged Actions

When Sage flags a tool call (as opposed to blocking it outright), you **must** present the details to the user and wait for their explicit approval before calling `sage_approve`. Never auto-approve a flagged action on your own — the user must decide.

## False Positive Reporting

If the user believes a Sage detection is incorrect (a wrong block, mistaken flag, or false alarm), you can report it using the MCP tools provided by Sage:

1. **`sage_list_audit_entries`** — Lists recent Sage audit log entries for the current conversation. Use this to find the `entry_id`s of the detections the user considers incorrect.
2. **`sage_report_false_positive`** — Submits a false positive report to the Sage backend. Requires a `description` (what was wrongly detected) and `reasoning` (why it is a false positive). Optionally accepts `entry_ids` to scope the report to specific entries.

When the user says a detection was wrong, a false positive, or asks to report/dispute a Sage verdict, use these tools to help them.
