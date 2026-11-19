# MYRA ledger: read-only baseline (2026-11-19)

Scope: direct read-only schema inspection and aggregate ledger query. No user identifiers or secrets collected. This document is evidence for PR #62, **not** approval to run migrations.

| Check | Production | Homologation |
| --- | --- | --- |
| Credits | 21 | 0 |
| Distinct credited missions | 21 | 0 |
| Null mission references | 0 | 0 |
| Null journey references | 0 | 0 |
| Sum of amount | 210 | 0 |
| source_mission_id column | Absent | Present, NOT NULL |
| mission_id nullable | No | Yes |
| journey_id nullable | No | Yes |

Previously verified FK behavior: production mission/journey references use ON DELETE CASCADE; homologation uses ON DELETE SET NULL. Production authenticated role retains DELETE privilege on journeys; homologation does not. RLS policies must be evaluated separately from grants.

## Release blocker

Homologation contains no existing credits, so its current data cannot demonstrate preservation of the 21 production credit rows (210 MYRA). Do **not** run the migration on production based on the synthetic SQL or this baseline.

## Required rehearsal and acceptance

1. Use an isolated, authorized PostgreSQL environment with production-equivalent schema and **synthetic** existing ledger rows (including repeated attempts and distinct missions). No personal data should be copied.
2. Record counts, totals, source mission uniqueness and FK actions before and after applying the **actual** migration; assert no loss or duplicate credit.
3. Verify ledger credits survive deletion of mission/journey test parents while account deletion remains governed by privacy requirements.
4. Validate the real credit trigger, two authenticated user isolation, owner-scoped routes, RLS and service-role boundaries.
5. Resolve the assigned-exercise schema difference and the migration drift before a deployment decision.
6. Require separate explicit authorization for schema migration, production release or any paid clone.

Read-only verification queries:

```sql
SELECT count(*) AS credits, count(DISTINCT mission_id) AS distinct_missions,
       count(*) FILTER (WHERE mission_id IS NULL) AS null_missions,
       count(*) FILTER (WHERE journey_id IS NULL) AS null_journeys,
       coalesce(sum(amount),0) AS total_myra
FROM public.myryra_journey_myra_ledger;
```

```sql
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'myryra_journey_myra_ledger'
ORDER BY ordinal_position;
```

Evidence is a point-in-time snapshot; repeat the baseline immediately before any authorized rehearsal or migration.
