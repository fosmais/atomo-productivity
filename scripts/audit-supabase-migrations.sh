#!/usr/bin/env bash
# MYRYRA: inspect Git-tracked Supabase migrations without touching databases.
# Requirements: gh CLI authenticated with read access, jq.
# Usage: bash scripts/audit-supabase-migrations.sh [git-ref]
set -euo pipefail
REF="${1:-feat/myryra-mvp2-mika-agent-engine}"
REPO="fosmais/atomo-productivity"
if ! command -v gh >/dev/null || ! command -v jq >/dev/null; then
  echo "Required: gh and jq" >&2
  exit 2
fi
# GitHub Contents API: directory listings return at most 1000 entries.
# Fail closed if the listing is unexpectedly large; never claim complete coverage.
payload="$(gh api "repos/$REPO/contents/supabase/migrations?ref=$REF" --header 'Accept: application/vnd.github+json')"
count="$(jq 'length' <<<"$payload")"
if [[ "$count" -ge 1000 ]]; then
  echo "Directory listing may be truncated (>=1000 entries); use Git Trees API" >&2
  exit 3
fi
jq -r '.[] | select(.type=="file" and (.name | endswith(".sql"))) | .name' <<<"$payload" | sort
echo "Inventory: $count directory entries at $REF (no database actions)" >&2
