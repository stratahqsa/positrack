#!/usr/bin/env bash
# Engine-sync gate: the skill ships VENDORED copies of the engine + CLI so it is
# self-contained and installable straight from the repo. This script proves the
# vendored copies are byte-identical to the canonical sources. It is a HARD gate:
# it runs in the Step-3 verify, in CI, and inside package_skill.sh (which refuses
# to build on drift). Silent divergence between the installed skill and the
# deployed MCP is exactly the failure mode this prevents.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

pairs=(
  "core/ytcore.py:skill/positrack/scripts/ytcore.py"
  "cli/yt.py:skill/positrack/scripts/yt.py"
  "core/ytcore.py:web/api/_engine/ytcore.py"
)

drift=0
for pair in "${pairs[@]}"; do
  src="${pair%%:*}"; dst="${pair##*:}"
  if [ ! -f "$src" ] || [ ! -f "$dst" ]; then
    echo "DRIFT: missing file ($src or $dst)"; drift=1; continue
  fi
  if ! diff -u "$src" "$dst" >/dev/null; then
    echo "DRIFT: $dst differs from $src"
    diff -u "$src" "$dst" || true
    drift=1
  fi
done

if [ "$drift" -ne 0 ]; then
  echo "ENGINE SYNC CHECK FAILED — run: cp core/ytcore.py skill/positrack/scripts/ytcore.py && cp cli/yt.py skill/positrack/scripts/yt.py && cp core/ytcore.py web/api/_engine/ytcore.py"
  exit 1
fi
echo "engine sync OK (vendored skill copies match core/ + cli/)"
