#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PKG_DIR/../.." && pwd)"
BIN_DIR="$REPO_ROOT/bin"

mkdir -p "$BIN_DIR"

# Build JS bundles first
echo "Building JS bundles..."
cd "$PKG_DIR"
node esbuild.config.js

# Verify the Node binary has SEA support (sentinel fuse compiled in).
# Homebrew builds Node without SEA support — use the official binary from
# nodejs.org (or actions/setup-node in CI).
NODE_PATH="$(command -v node)"
if ! strings "$NODE_PATH" 2>/dev/null | grep -q "NODE_SEA_FUSE"; then
    echo "ERROR: Node binary at $NODE_PATH does not include SEA support."
    echo "       Homebrew builds Node without the SEA sentinel fuse."
    echo "       Install the official Node.js binary from https://nodejs.org"
    echo "       or use nvm/fnm to get a build with SEA support."
    echo "       CI uses actions/setup-node which provides the official binary."
    exit 1
fi

build_binary() {
    local entry_name="$1"
    local binary_name="$2"

    echo "Building SEA binary: $binary_name"

    # Generate per-binary SEA config (--build-sea takes a config JSON file)
    local sea_config="dist/sea-config-${entry_name}.json"
    cat > "$sea_config" <<SEACFG
{
  "main": "dist/${entry_name}.cjs",
  "output": "$BIN_DIR/$binary_name",
  "executable": "$NODE_PATH",
  "disableExperimentalSEAWarning": true
}
SEACFG

    node --build-sea "$sea_config"

    # Code sign on macOS (ad-hoc)
    if [[ "$(uname)" == "Darwin" ]]; then
        codesign --sign - "$BIN_DIR/$binary_name" 2>/dev/null || true
    fi

    echo "Built: $BIN_DIR/$binary_name"
}

build_binary "session-start" "sage-session-start"

echo ""
echo "SEA build complete. Binaries in $BIN_DIR/"
ls -lh "$BIN_DIR/"
