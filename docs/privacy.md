# Privacy

## What Data Is Sent

Sage uses Gen Digital cloud services for four purposes:

1. **URL reputation** — URLs extracted from tool calls are sent to a reputation API for malware/phishing/scam classification.
2. **File reputation** — Package hashes (SHA-256) from npm/PyPI registries are checked against a file reputation service.
3. **Version check** — On session start, Sage sends a POST request to a version-check endpoint with:
   - Sage version
   - Agent runtime (e.g. `claude-code`, `cursor`, `openclaw`, `opencode`, `vscode`)
   - Agent runtime version (when available)
   - OS, OS version, and architecture
   - Installation ID — a random UUID persisted at `~/.sage/installation-id`, generated once and reused across sessions
4. **Detection telemetry (Community IQ)** — When Sage issues a **deny** verdict, anonymous detection metadata is sent to improve detection quality. This includes:
   - The same envelope as version check (Sage version, agent runtime, OS, architecture, installation ID)
   - Detection signals (matched rule IDs, URL check results, package check results)
   - Tool type and limited content fields (command string, URL, or file path as applicable)
   - A unique event ID correlating the detection with the local audit log entry
   - This data is used to improve Sage's detection capabilities, not for user tracking. Community IQ can be disabled at any time via configuration.

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

With URL checks, file checks, and Community IQ all disabled, Sage operates fully offline using only local heuristics.

## More Information

- [Gen Digital Products Privacy Policy](https://www.avast.com/products-policy)
- [Gen Digital Privacy Center](https://www.gendigital.com/privacy/)
