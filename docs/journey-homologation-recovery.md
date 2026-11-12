# MYRYRA Journey — homologation branch recovery

## Observed 2026-11-12
- Main Supabase project: `qothgddrvrpeqsprslqk` (healthy; DO NOT apply unvalidated changes).
- A new isolated branch `myryra-mvp2-journey-homolog` failed with `MIGRATIONS_FAILED` and contained none of `public.events`, `public.myryra_journeys`, or `public.myryra_journey_missions`.
- Branch was deleted to stop hourly compute charges.
- Earlier homologation branches also show `MIGRATIONS_FAILED` and lack Journey tables.
- Main database migration history includes `20261109212001_create_atomic_journey_with_missions` and subsequent Journey migrations. This does **not** establish that the GitHub migration directory can be replayed from a clean database.

## Safe recovery procedure
1. Compare the ordered repository migration filenames and contents against the main database migration history; identify missing or duplicate versions and schema dependencies.
2. Obtain the *first failing migration* and exact PostgreSQL error from Supabase branch provisioning logs or CLI migration replay. Do not infer root cause from `MIGRATIONS_FAILED` alone.
3. Reproduce in a disposable local Supabase/Postgres environment before creating another hourly-billed branch.
4. Repair migration order/idempotency in a separate PR. Never rewrite already-applied production migration history or drop live data.
5. Run a clean migration replay and verify RLS, grants and table dependencies for `events`, `myryra_journeys` and `myryra_journey_missions`.
6. Only after clean replay, create a new isolated branch with approved cost, apply `20261112000100_myryra_journey_lesson_atomic.sql`, and exercise owner, duplicate, conflict, concurrency and timeout cases using test users.
7. Keep production unchanged until the integration tests and rollout checklist pass.

## Booking concurrency limitation
The RPC uses an advisory lock per user and a SHARE ROW EXCLUSIVE lock on `events` to wait for existing direct writes. A subsequent direct Agenda write can still overlap a booked lesson. A universal no-overlap policy requires a separate product/schema decision because existing events may legitimately overlap. Do not introduce a global exclusion constraint without checking existing data and UX requirements.
