# PR #63 — Two-role synthetic rehearsal and status-column grant evidence

Date: 2026-11-20. GitHub Actions run 44724085713, job 136246962392: **success**.

Verified job steps:
- isolated synthetic credit idempotence — success
- isolated synthetic FK transition — success
- actual migration on synthetic production-like schema — success
- two-role RLS and assessment credit isolation — success

The two-role test is a disposable PostgreSQL simulation, **not** an E2E test with Supabase Auth or actual deployment policies.

Read-only catalog query of effective column privileges on public.myryra_journey_missions:
- PROD authenticated UPDATE(status) = true, UPDATE(journey_id) = true.
- HOMOLOG authenticated UPDATE(status) = false, UPDATE(journey_id) = false.
- Neither environment has an assessment_passed column on this missions table (assessment data is stored elsewhere).

Combined with PROD's owner-scoped UPDATE RLS and absent educational completion guards, direct owner completion remains an **unverified security hypothesis** requiring authenticated E2E testing. The synthetic test proves only that the proposed guard pattern can enforce its checks in isolation.

Blocking release gates: real two-account Supabase Auth test, assessment bypass test, schema/migration parity, rollback plan and explicit authorization before DB changes or merge.
