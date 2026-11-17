#!/usr/bin/env bash
# MYRYRA: enumerate migration SQL files from a GitHub Git tree, read-only.
# Requirements: authenticated gh CLI, jq.
# Usage: bash scripts/audit-supabase-migrations.sh [git-ref]
set -euo pipefail
export LC_ALL=C
REF="${1:-feat/myryra-mvp2-mika-agent-engine}"
REPO="fosmais/atomo-productivity"
for bin in gh jq; do
  command -v "$bin" >/dev/null || { echo "Missing required executable: $bin" >&2; exit 2; }
done
# Resolve the ref to a commit SHA first, avoiding slash-containing branch names
# being misinterpreted as API path segments.
sha="$(gh api "repos/$REPO/commits/$REF" --jq '.sha')"
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || { echo "Could not resolve ref: $REF" >&2; exit 3; }
payload="$(gh api "repos/$REPO/git/trees/$sha?recursive=1" --header 'Accept: application/vnd.github+json')"
if [[ "$(jq -r '.truncated // false' <<<"$payload")" != false ]]; then
  echo "GitHub tree response truncated; inventory incomplete" >&2
  exit 4
fi
files="$(jq -r '.tree[] | select(.type=="blob" and (.path | startswith("supabase/migrations/")) and (.path | endswith(".sql"))) | .path | split("/") | last' <<<"$payload" | sort -u)"
if [[ -z "$files" ]]; then
  echo "No migration SQL files found in Git tree; cannot claim a complete comparison" >&2
  exit 5
fi
printf '%s\n' "$files"
echo "Enumerated Git-tracked migration SQL filenames at commit $sha (read-only)" >&2
