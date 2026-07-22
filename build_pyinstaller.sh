#!/bin/bash
# Compatibility wrapper for the cross-platform PyInstaller build.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
exec python3 build.py "$@"
