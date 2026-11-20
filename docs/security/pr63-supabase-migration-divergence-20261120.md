# PR #63 — Supabase migration history divergence, read-only investigation (2026-11-20)

Supabase project IDs: PROD `qothgddrvrpeqsprslqk`; MVP2 HOMOLOG `xanavauqzsrgvdfhcrsm`.

Read-only inspection of `supabase_migrations.schema_migrations` and branch status:

| | PROD | MVP2 HOMOLOG |
|---|---|---|
| Applied migration records | 45 | 36 |
| Earliest migration | 20261030174834 | 20261030174834 |
| Latest migration | 20261113182502 | 20261118043719 |
| Branch state | FUNCTIONS_DEPLOYED (main) | MIGRATIONS_FAILED |
| Runtime state | ACTIVE_HEALTHY | ACTIVE_HEALTHY |

Only the earliest migration appears shared in the returned version lists; the subsequent histories diverge. Counts are **records of applied migrations**, not a count of failed migrations or missing features.

PROD includes `myryra_journey_myra_rewards_ledger` and `mika_teacher_sessions_production`; HOMOLOG instead includes `protect_journey_assessments_staging_20261114`, `preserve_myra_history_staging_20261115`, `guard_assessed_mission_completion_staging_20261116`, and `journey_assigned_exercises_foundation`. These are different deployment histories, not interchangeable versions.

The branch status alone does **not** identify the failed migration, its SQL error, or whether the failure occurred during branch creation/rebase. Do not attribute a root cause without deployment logs.

Safe next actions:
1. Inspect the failing migration deployment log / branch operation error in Supabase Dashboard or supported API.
2. Compare exact schema and migration files against applied histories; review conflicting objects, constraints, triggers and grants.
3. Plan a forward-only reconciliation, with backups and MYRA ledger preservation, on a disposable production-like clone.
4. Run authenticated two-user E2E only after homologation is confirmed healthy and representative.
5. Seek explicit authorization before any branch reset/rebase, SQL DDL, data mutation, merge or PROD rollout.

No DDL, migration, reset or rebase was executed.
