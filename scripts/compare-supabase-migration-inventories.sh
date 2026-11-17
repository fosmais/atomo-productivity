#!/usr/bin/env bash
# Compare Supabase migration VERSION identifiers, not entire filenames.
# Legacy 8-digit SQL filenames are reported separately; they are not silently
# treated as registered 14-digit Supabase migrations.
# Requires gh, jq, bash, coreutils. Read-only.
set -euo pipefail
export LC_ALL=C
ref="${1:-feat/myryra-mvp2-mika-agent-engine}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
bash scripts/audit-supabase-migrations.sh "$ref" > "$tmp/git-filenames.txt"
extract_versions() {
  local input="$1" output="$2" filename
  : > "$output"
  while IFS= read -r filename || [[ -n "$filename" ]]; do
    [[ -z "$filename" ]] && continue
    if [[ "$filename" =~ ^([0-9]{14})_.+\.sql$ ]]; then
      printf '%s\n' "${BASH_REMATCH[1]}" >> "$output"
    elif [[ "$input" == "$tmp/git-filenames.txt" && "$filename" =~ ^[0-9]{8}_.+\.sql$ ]]; then
      printf '%s\n' "$filename" >> "$tmp/legacy.txt"
    else
      echo "Unexpected migration filename: $filename" >&2
      exit 4
    fi
  done < "$input"
  sort -o "$output" "$output"
  if [[ -n "$(uniq -d "$output")" ]]; then
    echo "Duplicate migration version(s) in $input:" >&2
    uniq -d "$output" >&2
    exit 5
  fi
}
extract_versions "$tmp/git-filenames.txt" "$tmp/git-versions.txt"
echo "=== Legacy 8-digit Git SQL filenames (manual review; not registry-equivalent) ==="
if [[ -f "$tmp/legacy.txt" ]]; then sort "$tmp/legacy.txt"; else echo "(none)"; fi
for env in prod events finance; do
  file="docs/supabase-${env}-registered-migrations-20261117.txt"
  [[ -f "$file" ]] || { echo "Missing registry snapshot: $file" >&2; exit 2; }
  extract_versions "$file" "$tmp/$env.txt"
  echo "=== $env versus Git at $ref ==="
  echo "Registered version missing in Git:"
  comm -23 "$tmp/$env.txt" "$tmp/git-versions.txt"
  echo "Git version not registered in $env:"
  comm -13 "$tmp/$env.txt" "$tmp/git-versions.txt"
done
echo "NOTE: version-only comparison; SQL contents, checksums and schema parity unverified."
