# PR #63 — RLS policy parity audit (2026-11-20)

Read-only inspection of `pg_policy` in PROD `qothgddrvrpeqsprslqk` and MVP2 HOMOLOG `xanavauqzsrgvdfhcrsm`.

- **Missions**: both environments have four owner-scoped RLS policies: SELECT, INSERT, UPDATE and DELETE. The UPDATE USING and WITH CHECK require a journey owned by `auth.uid()`. This prevents cross-owner reassignment via the policy, but **does not require a passing assessment**.
- **Journeys in PROD**: owner-scoped SELECT, INSERT, UPDATE and DELETE policies exist.
- **Journeys in HOMOLOG**: only owner-scoped SELECT and INSERT policies were returned. There is no owner UPDATE or DELETE policy in the inspected catalog. This can break normal journey editing and deletion workflows even if API authorization is correct.
- **Triggers**: PROD has `myryra_mission_credit_myra` only; HOMOLOG additionally has `myryra_assessed_mission_completion_guard` and `myryra_guard_completed_mission_insert`.
- **Grants**: `authenticated` has `UPDATE(status)` in PROD, but not in HOMOLOG.

Security implications: owner RLS is necessary but not sufficient to enforce learning assessment; lack of homolog grants/policies may produce false negatives in functional testing. No real authenticated exploit or functional completion test has been run.

Release gate: design a least-privilege, server-authorized mission completion path, reconcile journey owner policies and grants with an explicit review, rehearse on disposable DB, and run real Auth E2E. Do not copy PROD grants wholesale into HOMOLOG or remove protections.

No schema/data changes were made.
