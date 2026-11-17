#!/usr/bin/env bash
# Compare Git migration files against Supabase registry snapshots (read-only).
# Run from repository root after checking out PR #55.
# Usage: bash scripts/compare-supabase-migration-inventories.sh [git-ref]
set -euo pipefail
ref="${1:-feat/myryra-mvp2-mika-agent-engine}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

bash scripts/audit-supabase-migrations.sh "$ref" > "$tmp/git.txt"
for env in prod events finance; do
  file="docs/supabase-${env}-registered-migrations-20261117.txt"
  if [[ ! -f "$file" ]]; then
    echo "Missing registry snapshot: $file" >&2
    exit 2
  fi
  sort -u "$file" > "$tmp/$env.txt"
  echo "=== $env versus Git at $ref ==="
  echo "Registered in $env but no matching filename in Git:"
  comm -23 "$tmp/$env.txt" "$tmp/git.txt" || true
  echo "In Git but not registered in $env:"
  comm -13 "$tmp/$env.txt" "$tmp/git.txt" || true
  echo
done
echo "NOTE: This is a filename comparison only. It does not verify migration SQL content, checksums, execution order, or schema parity."
