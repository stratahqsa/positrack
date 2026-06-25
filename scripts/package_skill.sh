#!/usr/bin/env bash
# Package the Positrack skill into dist/positrack.skill.
# The archive's top-level entry is `positrack/SKILL.md` (the .skill layout), so it
# unzips into ~/.claude/skills/positrack/ or installs via the marketplace.
#
# HARD GATE: this refuses to build if the vendored engine copies have drifted from
# core/ + cli/ — a stale skill shipping different logic than the deployed MCP is
# exactly what we prevent.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> engine-sync gate"
bash scripts/check_sync.sh

echo "==> packaging skill"
mkdir -p dist
rm -f dist/positrack.skill
( cd skill && zip -r -X "$ROOT/dist/positrack.skill" positrack \
    -x '*/__pycache__/*' -x '*.pyc' -x '*.pyo' -x '*/.DS_Store' >/dev/null )

first="$(unzip -Z1 dist/positrack.skill | head -1)"
echo "==> built dist/positrack.skill (top entry: $first)"
case "$first" in
  positrack/*) ;;
  *) echo "ERROR: top-level entry is '$first', expected 'positrack/...'"; exit 1 ;;
esac
# the engine + SKILL.md must be in the bundle
for need in positrack/SKILL.md positrack/scripts/yt.py positrack/scripts/ytcore.py; do
  unzip -Z1 dist/positrack.skill | grep -qx "$need" || { echo "ERROR: missing $need in bundle"; exit 1; }
done
echo "==> OK"
unzip -l dist/positrack.skill
