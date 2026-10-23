#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo "== check: vibe-pixel-wall =="
echo "-> npm run build"
npm run build
echo "-> npm test"
npm test
echo "== OK =="
