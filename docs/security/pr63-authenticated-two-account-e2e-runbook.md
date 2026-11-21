# MYRYRA MVP2 — Supabase Auth two-account E2E runbook

Status: **NOT EXECUTED**. This is a release gate, not evidence of successful authentication.

## Preconditions
- Use only the homologation Supabase project (never PROD).
- Create two disposable users A and B through supported Supabase Auth signup/admin API, using non-personal test identities. Do not insert into `auth.users` directly.
- Verify both accounts can obtain separate authenticated sessions and that required legal acceptance is satisfied.
- Confirm homologation migrations are healthy, including `myryra_journey_assigned_exercises` and educational completion guards.
- Do not record access tokens, passwords, service-role keys, or personal data in CI logs or Git.

## Authenticated test matrix
1. A creates a journey and a mission; B creates a distinct journey and mission.
2. With B's access token, request A's journey, mission, exercise, learning progress and MYRA ledger. All cross-owner reads must be denied or return no rows.
3. With B's token, attempt to update A's mission status, reassign A's mission, submit feedback for A's exercise and delete A's journey. All must fail without changing any records.
4. With A's token, attempt to complete an educational mission before an official exercise and passing assessment. Must fail; MYRA ledger unchanged.
5. Complete A's official assessment through the supported application workflow, then complete the mission. Exactly one credit should appear for A, none for B.
6. Repeat completion and status toggles: no duplicate credit. Verify credits remain in history after supported archive flow.
7. Confirm ordinary owner edits still work, and all records created for the test are cleaned up through approved application flows only.

## Evidence required
Record timestamp, environment project ID, anonymized account labels, endpoint/operation, expected and actual HTTP status, pre/post counts, and any failure. Do not treat HTTP 200 with zero updated rows as success.

## Stop conditions
- Missing or failed migrations, grants that prevent normal app workflows, unexpected access to another user's records, unauthorized credit, or unexpected data loss.
- Stop and report; do not alter RLS, triggers, migrations, production or payment settings automatically.

This plan is intentionally separate from disposable PostgreSQL role tests. Those tests cannot validate real Supabase JWT, Auth or deployed RLS.
