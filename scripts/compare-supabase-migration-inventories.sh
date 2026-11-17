#!/usr/bin/env bash
# Compare Supabase migration VERSION identifiers, not entire filenames.
# Requires: gh CLI, jq, bash, coreutils. Read-only.
# Usage: bash scripts/compare-supabase-migration-inventories.sh [git-ref]
set -euo pipefail
export LC_ALL=C
ref="${1:-feat/myryra-mvp2-mika-agent-engine}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

bash scripts/audit-supabase-migrations.sh "$ref" > "$tmp/git-filenames.txt"
extract_versions() {
  local input="$1" output="$2" filename version
  : > "$output"
  while IFS= read -r filename || [[ -n "$filename" ]]; do
    [[ -z "$filename" ]] && continue
    if [[ ! "$filename" =~ ^([0-9]{14})_.+\.sql$ ]]; then
      echo "Unexpected migration filename: $filename" >&2
      exit 4
    fi
    version="${BASH_REMATCH[1]}"
    printf '%s\n' "$version" >> "$output"
  done < "$input"
  sort -o "$output" "$output"
  if [[ -n "$(uniq -d "$output")" ]]; then
    echo "Duplicate migration version(s) in $input:" >&2
    uniq -d "$output" >&2
    exit 5
  fi
}
extract_versions "$tmp/git-filenames.txt" "$tmp/git-versions.txt"
for env in prod events finance; do
  file="docs/supabase-${env}-registered-migrations-20261117.txt"
  if [[ ! -f "$file" ]]; then
    echo "Missing registry snapshot: $file" >&2
    exit 2
  fi
  extract_versions "$file" "$tmp/$env.txt"
  echo "=== $env versus Git at $ref ==="
  echo "Registered version missing in Git:"
  comm -23 "$tmp/$env.txt" "$tmp/git-versions.txt"
  echo "Git version not registered in $env:"
  comm -13 "$tmp/$env.txt" "$tmp/git-versions.txt"
  echo
done
echo "NOTE: version-only comparison; it does NOT prove matching SQL content, checksums, or schema parity."
