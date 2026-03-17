# Session-Level Behavioral Baselines

This PR adds session-level behavioral baseline tracking to Sage, enabling detection of anomalous patterns that are invisible at the individual action level.

## The Problem

Sage's current architecture checks each tool call independently against static rules and reputation services. This catches known-bad patterns effectively, but misses threats that only become visible when looking at patterns across multiple actions within a session:

- **Volume anomaly**: Agent normally runs 5–10 bash commands per session. Under manipulation, it runs 80 — each individually allowed, but the rate is 10x baseline.
- **Exfiltration via allowed channels**: Agent makes 30 curl calls to different subdomains of a single host. Each URL individually passes reputation, but 30 requests to *.attacker.com in one session is suspicious.
- **Credential probing**: Agent reads 15 different files matching *key*, *secret*, *token* patterns. Each individual Read might be fine, but scanning 15 credential-shaped files in sequence is suspicious.
- **Gradual scope expansion**: Over 5 sessions, agent progressively accesses /home/user/project/, then /etc/, then /var/, then /root/. Each access might pass heuristics, but the expanding radius is a signal.

## Solution

A new `SessionBaselineTracker` module that:

1. Tracks per-session behavioral metrics (commands/tool-calls per turn, file-write patterns, web-request frequency)
2. Maintains rolling baselines with sliding window averages and standard deviations
3. Flags deviations >2σ from baseline as warnings, >3σ as critical
4. Integrates with the existing evaluation pipeline

## Implementation

### New Module: `session-baseline.ts`

Key exports:
- `SessionBaselineTracker` - main class for tracking and anomaly detection
- `createSessionBaselineTracker()` - factory function
- `SessionBaselineConfig` - configuration interface

### Configuration

Add to your Sage config:

```json
{
  "session_baseline": {
    "enabled": true,
    "window_size": 10,
    "check_interval": 5,
    "std_threshold": 2.0,
    "storage_path": "~/.sage/session-baselines.json"
  }
}
```

### Integration Example

```typescript
import { createSessionBaselineTracker, loadConfig } from "./core/src";

// Initialize tracker
const config = await loadConfig();
const tracker = createSessionBaselineTracker(config.session_baseline);

// In your tool evaluation pipeline, after each tool call:
const session = tracker.recordAction(sessionId, toolName, toolInput, agentId);

// Check for anomalies every N actions
if (tracker.shouldCheckBaselines(session.actionCounts[toolName] || 0)) {
  const anomalies = await tracker.checkBaselines(session, agentId);
  
  for (const anomaly of anomalies) {
    if (anomaly.severity === "critical") {
      // Block or require immediate confirmation
      return { verdict: "deny", reason: anomaly.description };
    } else if (anomaly.severity === "warning") {
      // Flag for user review
      return { verdict: "ask", reason: anomaly.description };
    }
  }
}
```

## Test Coverage

Comprehensive test suite in `__tests__/session-baseline.test.ts`:

- Session tracking (action accumulation, domain concentration, curl detection)
- Baseline checking (volume anomalies, domain concentration, file radius)
- Severity classification (warning vs critical thresholds)
- Configuration edge cases (disabled mode, custom thresholds)

Run tests: `pnpm test session-baseline`

## Example Detection Scenarios

### Volume Anomaly Detection
```
Session 1-5 (baseline):  5, 6, 7, 5, 6 bash commands (mean: 5.8, σ: 0.8)
Session 6 (anomalous):   80 bash commands (deviation: 92.5σ) → CRITICAL
```

### Domain Concentration
```
Session 1-5 (baseline):  max 3 requests to any single domain
Session 6 (anomalous):   30 requests to attacker.com → CRITICAL
```

### File Path Radius Expansion
```
Session 1-5 (baseline):  /home/user/project/* (depth: 3)
Session 6 (anomalous):   /etc/shadow, /root/.ssh/id_rsa (depth: 4-5) → WARNING
```

## Storage Format

Baselines are stored in `~/.sage/session-baselines.json`:

```json
{
  "byAgent": {
    "agent-123": {
      "bashCommandCounts": { "mean": 6.2, "stdDev": 1.1, "windowSize": 5 },
      "domainConcentration": { "mean": 2.5, "stdDev": 0.7, "windowSize": 5 },
      "filePathRadius": { "mean": 3.0, "stdDev": 0.5, "windowSize": 5 }
    }
  }
}
```

## Performance Impact

- Minimal overhead: O(1) action recording, O(1) anomaly checks
- Baseline storage: <1KB per agent after 10 sessions
- Check interval configurable (default: every 5 actions)

## Future Enhancements

- Tool type distribution shift detection (unusual Read/Write/Bash ratios)
- Cross-session pattern detection (credential access followed by curl)
- Adaptive thresholds based on agent role/context
- Integration with Sage's TTL allowlist (longer TTLs for stable agents)

## Related Issues

- Closes #27 (session-level behavioral baselines feature request)
- Complements #5 (TTL-based allowlist) - behavioral baselines could inform optimal TTL values
