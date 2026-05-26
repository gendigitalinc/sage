# Privacy

## What Data Is Sent

Sage uses Gen Digital cloud services for four purposes:

1. **URL reputation** — URLs extracted from tool calls are sent to a reputation API for malware/phishing/scam classification.
2. **File reputation** — Package hashes (SHA-256) from npm/PyPI registries are checked against a file reputation service.
3. **Version check** — On session start, Sage sends a POST request to a version-check endpoint with:
   - Sage version
   - Agent runtime (e.g. `claude-code`, `cursor`, `openclaw`, `opencode`, `vscode`)
   - Agent runtime version (when available). For Cursor and VS Code, Sage reads the host's `product.json` and reports the actual application version (e.g. Cursor `3.1.14`, VS Code `1.117.0`) rather than the underlying VS Code engine version that `vscode.version` would return for Cursor.
   - OS, OS version, and architecture
   - Installation ID — a random UUID persisted at `~/.sage/installation-id`, generated once and reused across sessions
4. **Detection telemetry (Community IQ)** — When Sage issues a **deny** verdict, anonymous detection metadata is sent to improve detection quality. This includes:
   - The same envelope as version check (Sage version, agent runtime, OS, architecture, installation ID)
   - Detection signals (matched rule IDs, URL check results, package check results, and on Windows/WSL AMSI check results — see below)
   - A structured `content` snapshot with strict per-field caps and sanitization: `command` ≤ 512 chars, `url` ≤ 512 chars, `file_path` ≤ 512 chars, `package_name` ≤ 256 chars, `package_version` / `package_registry` ≤ 128 chars. Home-directory prefixes (e.g. `/home/jane`, `C:\Users\jane`) in `file_path` and `command` are replaced with `~` before send.
   - A unique event ID correlating the detection with the local audit log entry
   - This data is used to improve Sage's detection capabilities, not for user tracking. Community IQ can be disabled at any time via configuration.

On Windows and WSL, AMSI denies (Bash command, file write, or file edit content flagged by the locally installed antimalware provider) record an `amsi_checks` entry in the audit log and detection-telemetry signals. Each entry contains a synthesized detection name (`AMSI|DETECTED` for malware, `AMSI|BLOCKED_BY_ADMIN` for admin policy blocks — the Win32 AMSI API only returns a numeric threat level, not a named detection), the labelled scan target (e.g. `Bash:command`, `Write:<path>`), an optional `content_snippet` capped at 200 chars with home directories scrubbed, and the raw numeric `amsi_result`.

## What Data Stays Local

- Source code and file contents are never transmitted
- Commands and command arguments stay local (detection telemetry sends only the command string for Bash denies, not arguments parsed from it)
- File paths stay local (detection telemetry sends only the target file path for file-operation denies)
- Threat definition matching (heuristics) runs entirely locally
- The verdict cache, allowlist, and audit log are local files

## Configuration

URL and file reputation checks can be disabled in `~/.sage/config.json`:

```json
{
  "url_check": { "enabled": false },
  "file_check": { "enabled": false }
}
```

Detection telemetry can be disabled independently:

```json
{
  "community_iq": false
}
```

With URL checks, file checks, and Community IQ all disabled, all detection runs locally via heuristics. The only outbound traffic that remains is the lightweight session-start version check described above (Sage version, agent runtime, OS, installation ID — no command, URL, or file content).

## More Information

- [Gen Digital Products Privacy Policy](https://www.avast.com/products-policy)
- [Gen Digital Privacy Center](https://www.gendigital.com/privacy/)
