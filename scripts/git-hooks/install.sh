#!/usr/bin/env bash
# Configures git to use tracked hook scripts.
# Called automatically by pnpm install (via the "prepare" script).
set -euo pipefail

# Skip in CI — hooks are for local dev only.
[[ -n "${CI:-}" ]] && exit 0

# Skip when not inside a git work tree (e.g. installed as a dependency).
git rev-parse --is-inside-work-tree &>/dev/null || exit 0

HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"

# Ensure scripts are executable (git may not preserve the bit on some systems).
chmod +x "$HOOKS_DIR/pre-commit" "$HOOKS_DIR/pre-push" 2>/dev/null || true

git config core.hooksPath scripts/git-hooks
echo "Git hooks installed (core.hooksPath -> scripts/git-hooks)"
