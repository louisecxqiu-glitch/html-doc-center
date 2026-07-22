#!/bin/bash
# Compatibility wrapper. The canonical macOS release entry point is
# scripts/release_macos.py; this command creates a local test app only.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

python3 build.py "$@"
echo "For a distributable signed DMG, run: python3 scripts/release_macos.py"
