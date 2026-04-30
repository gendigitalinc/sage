# AMSI Scanning

Sage integrates with the Windows [Antimalware Scan Interface (AMSI)](https://learn.microsoft.com/en-us/windows/win32/amsi/antimalware-scan-interface-portal) to detect malware in tool call content and installed plugin files. When a tool call is intercepted or a plugin is scanned at session start, the content is passed to the locally installed antimalware provider (e.g. Windows Defender) for scanning.

## Supported Platforms

| Platform | Support |
|----------|---------|
| Windows 10/11 | Supported (koffi FFI or PowerShell) |
| WSL (Windows Subsystem for Linux) | Supported (PowerShell only) |
| macOS | Not available (skipped at runtime) |
| Linux (non-WSL) | Not available (skipped at runtime) |

AMSI is a Windows API. On macOS and non-WSL Linux the check is silently skipped and has no effect on verdicts. Under WSL, Sage detects the WSL environment and uses the PowerShell backend via WSL interop to call the Windows-side AMSI API.

## How It Works

1. When a tool call arrives, Sage extracts scannable content from the tool input
2. The content is passed to the AMSI API via the locally installed antimalware provider
3. The provider returns a numeric result indicating whether the content is clean, blocked by admin policy, or detected as malware
4. The result is fed into the decision engine alongside heuristic, URL, and package signals

### What Gets Scanned

| Scan Type | Content Scanned |
|-----------|----------------|
| Bash | Command string |
| Write | File content being written |
| Edit | New string content |
| apply_patch | Patch content |
| Plugin | Plugin file content (session start scan) |

Content longer than 1 MB is truncated before scanning.

### Backends

The AMSI client uses two backends with automatic fallback:

1. **Koffi FFI (primary)** - Calls `amsi.dll` directly via the `koffi` native FFI package. Fast, but requires the optional `koffi` dependency.
2. **PowerShell P/Invoke (fallback)** - Spawns PowerShell with embedded C# P/Invoke bindings to the same AMSI API. No extra dependencies required (PowerShell is built into Windows).

On native Windows, the client probes the koffi backend first. If it is unavailable (e.g. `koffi` not installed), it falls back to PowerShell. Under WSL, the koffi backend is skipped (it cannot load Windows DLLs from Linux userspace) and only the PowerShell backend is tried. If no backend succeeds, AMSI scanning is gracefully disabled and all tool calls proceed without it (fail-open).

> **Note:** WSL-to-Windows process spawning adds overhead compared to native Windows. The PowerShell backend already spawns a new process per scan, so under WSL each scan has additional cross-boundary latency.

## Verdicts

| AMSI Result | Verdict | Confidence | Severity |
|-------------|---------|------------|----------|
| Malware detected (result >= 32768) | `deny` | 1.0 | critical |
| Blocked by admin policy (16384 <= result < 32768) | `deny` | 0.9 | critical |
| Clean (result < 16384) | No signal | - | - |

AMSI deny signals use the `malware` category and take precedence over other signal sources during merge (deny > ask > allow). Clean results produce no signal, so the verdict depends on the other detection layers.

AMSI results are not cached — each tool call triggers a fresh scan.

## Audit Log and Telemetry

AMSI denials are recorded in the audit log entry's `signals.amsi_checks` array and forwarded in detection telemetry and false-positive report payloads. Each entry contains:

| Field | Description |
|-------|-------------|
| `detection_name` | Synthesized label — `AMSI|DETECTED` (result ≥ 32768) or `AMSI|BLOCKED_BY_ADMIN` (16384 ≤ result < 32768). The Win32 AMSI API returns only a numeric threat level, not a named detection like other reputation services. |
| `content_name` | The label identifying what was scanned, e.g. `Bash:command`, `Write:<path>`, `Edit:<path>`. Home-directory paths are scrubbed to `~`. |
| `content_snippet` | Optional excerpt of the scanned content, capped at 200 characters with home directories scrubbed. Self-contained for FP triage so the analyst sees the actual command or content that triggered the detection. |
| `amsi_result` | Raw numeric AMSI result code from `AmsiScanBuffer`. |

Clean results (below the admin-block threshold) produce no signal entry.

## Configuration

```json
{
  "amsi_check": {
    "enabled": true
  }
}
```

- `amsi_check.enabled` - set to `false` to disable AMSI scanning. Default: `true`.

AMSI scanning is enabled by default and runs on Windows and WSL. On other platforms the setting has no effect.
