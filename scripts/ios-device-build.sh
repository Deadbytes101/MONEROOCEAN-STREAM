#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "missing xcodegen"
  echo "install: brew install xcodegen"
  exit 1
fi

xcodegen generate

TEAM_ID="${DEVELOPMENT_TEAM:-}"
if [[ -z "$TEAM_ID" ]]; then
  echo "set DEVELOPMENT_TEAM first"
  echo "example: export DEVELOPMENT_TEAM=ABCDE12345"
  exit 1
fi

xcodebuild \
  -project MoneroOceanSteam.xcodeproj \
  -scheme MoneroOceanSteam \
  -configuration Debug \
  -destination 'generic/platform=iOS' \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CODE_SIGN_STYLE=Automatic \
  build
