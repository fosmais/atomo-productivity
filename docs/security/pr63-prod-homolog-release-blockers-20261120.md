# PR #63 — Release blocker: production/homologation drift (2026-11-20)

Read-only Supabase catalog verification, performed 2026-11-20.

| Check | PROD `qothgddrvrpeqsprslqk` | HOMOLOG `xanavauqzsrgvdfhcrsm` |
|---|---|---|
| `public.myryra_journey_assigned_exercises` | absent | present |
| `myryra_assessed_mission_completion_guard` trigger | absent | present |
| `myryra_guard_completed_mission_insert` trigger | absent | present |
| `authenticated` can UPDATE missions.status | true | false |
| Supabase branch migration status | default main | **MIGRATIONS_FAILED** |

Interpretation: PROD has an owner-scoped mission UPDATE path but lacks the homologation assessment guard; this is a potential unauthorized-completion / MYRA-credit path, **not an authenticated exploit demonstration**. Homologation lacks the column UPDATE grant, which may prevent ordinary mission completion through the authenticated client. Its failed migration status also prevents treating it as production-equivalent.

Required release gates:
1. Investigate and reconcile failed homologation migrations without overwriting data.
2. Review mission status transitions, RLS, grants, trigger execution and credit idempotence; choose an approved least-privilege server-side completion path.
3. Rehearse the exact reviewed migrations on a disposable production-like database, including preservation of existing MYRA ledger history.
4. Run the real two-account Supabase Auth E2E matrix in homologation with confirmed disposable identities.
5. Obtain explicit approval before any schema/grant changes, merge or PROD deployment.

No schema/grant/user data changes were made by this audit. Synthetic PostgreSQL checks passing is not equivalent to these release gates.
