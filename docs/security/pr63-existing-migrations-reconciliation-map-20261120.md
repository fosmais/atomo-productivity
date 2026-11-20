# PR #63 — Existing migration reconciliation map (2026-11-20)

## Evidence

These migration files already exist on the PR branch:

- `supabase/migrations/20261114000300_protect_journey_assessments.sql`: revokes direct authenticated mutation of learning progress and mission UPDATE, retains learning progress SELECT.
- `supabase/migrations/20261115000100_harden_journey_table_privileges.sql`: revokes TRUNCATE, TRIGGER and REFERENCES on mission/progress/ledger.
- `supabase/migrations/20261116000100_guard_assessed_mission_completion.sql`: creates trigger checking persisted passing assessment before completing a mission.

Read-only database checks show PROD does not have these effective protections (2/7 release gates), while HOMOLOG has them (7/7). The HOMOLOG applied migrations list uses different migration versions/names from repository filenames (e.g. `20261114142252 protect_journey_assessments_staging_20261114`, `20261116011228 harden_journey_table_privileges_staging_20261115`, `20261116230713 guard_assessed_mission_completion_staging_20261116`). Thus blindly replaying repository migrations or rebasing a failed branch is unsafe.

## Implementation path (not executed)

1. Extract exact production and staging schema diffs for dependencies: mission assessment policy, assigned exercises, learning progress fields, trigger functions, existing ledger uniqueness.
2. Audit other direct client writes and existing production users; preserve legitimate journeys and MYRA credits.
3. Produce a *new forward-only migration* targeting actual PROD schema, incorporating all required staged guard evolutions (not only the 20261116000100 version). Do not drop or overwrite historical migrations.
4. Validate on an isolated, healthy staging clone and run authenticated two-account E2E and concurrency scenarios. Avoid reusing the failed branch as proof of deployability.
5. Obtain explicit production approval and a reviewed rollback plan; only then apply during monitored change window.

## Current holds
- HOMOLOG branch `MIGRATIONS_FAILED` despite healthy runtime.
- No authenticated E2E execution evidence.
- PROD assessment and MYRA gates fail 5 of 7 checks.

This document makes no database changes.
