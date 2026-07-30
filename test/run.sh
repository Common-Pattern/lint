#!/usr/bin/env bash
# Verify each plugin fires on the violations fixture and stays silent on the
# clean one.
#
# Both halves matter, and the second matters more: a date rule that produces
# false positives gets suppressed, and a suppressed rule protects nothing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

EXPECTED_VIOLATIONS=15

# Prefer the locally installed Biome (`pnpm install` first). `BIOME_BIN` lets
# CI or a different package manager point at its own binary.
if [ -n "${BIOME_BIN:-}" ]; then
  read -ra BIOME <<<"$BIOME_BIN"
elif [ -x "./node_modules/.bin/biome" ]; then
  BIOME=(./node_modules/.bin/biome)
else
  echo "No Biome found. Run 'pnpm install' (or set BIOME_BIN)." >&2
  exit 1
fi

run_biome() {
  "${BIOME[@]}" check --max-diagnostics=100 "$1" 2>&1 || true
}

fail() { echo "FAIL: $1" >&2; exit 1; }

# Compare the committed artifact against a freshly generated one, rather than
# asking git whether the file is dirty. Same assertion on CI's clean checkout,
# but it also holds while you are mid-change: the git form reported "stale" for
# any edit that was correctly regenerated and simply not committed yet, so the
# documented `pnpm build && pnpm test` loop could not go green until after the
# commit it was supposed to gate.
echo "==> plugins/all.grit is in sync with the individual plugins"
generated="$(mktemp)"
trap 'rm -f "$generated"' EXIT
ALL_GRIT_OUT="$generated" node scripts/build-all.mjs >/dev/null
if ! diff -q "$generated" plugins/all.grit >/dev/null; then
  diff -u plugins/all.grit "$generated" || true
  fail "plugins/all.grit is stale — run 'pnpm build' and commit the result"
fi
echo "    ok"

echo "==> violations fixture (expecting $EXPECTED_VIOLATIONS diagnostics)"
violations_output="$(run_biome test/fixtures/violations.ts)"
violations_count="$(grep -c 'plugin ━' <<<"$violations_output" || true)"
echo "    got $violations_count"
[ "$violations_count" -eq "$EXPECTED_VIOLATIONS" ] || {
  echo "$violations_output"
  fail "expected $EXPECTED_VIOLATIONS plugin diagnostics, got $violations_count"
}

echo "==> clean fixture (expecting 0 diagnostics)"
clean_output="$(run_biome test/fixtures/clean.ts)"
clean_count="$(grep -c 'plugin ━' <<<"$clean_output" || true)"
echo "    got $clean_count"
[ "$clean_count" -eq 0 ] || {
  echo "$clean_output"
  fail "clean fixture produced $clean_count plugin diagnostics; a false positive makes the rule get suppressed"
}

echo "OK"
