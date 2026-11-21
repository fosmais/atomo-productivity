# PR #63 — P0 remediation sequence (proposal only, 2026-11-20)

## Verified
- PROD authenticated role has INSERT/UPDATE on all columns of `public.myryra_journey_learning_progress`, including `assessment_passed`, `assessment_score`, `feedback`, `assessed_at`, `assessment_attempts`.
- PROD authenticated role has UPDATE on `public.myryra_journey_missions.status`; completion credit trigger awards on completed status without requiring assessment. Database assessment guards are absent in PROD.
- HOMOLOG passes 7/7 read-only release gates but has branch status `MIGRATIONS_FAILED`.
- Server endpoints for saving answers and updating missions use `createSupabaseAdmin()` for writes after owner checks. Re-check every other client write path before revoking broad privileges.

## Ordered fix — not executed
1. Inventory all client-side direct inserts/updates to journey missions and learning progress, including mobile and older routes. Identify compatibility impact.
2. Reconcile the migration graph without reset/rebase on the failing homolog branch. Capture the exact failed migration and schema delta.
3. Create forward-only migration to revoke `authenticated` direct writes to server-owned grade fields and mission completion status; preserve legitimate read and creation workflows. Ensure grants are checked both at table and column levels.
4. Add and verify DB-level guards for assessed completion on INSERT and UPDATE. Require persisted passing assessment for current exercise; ensure trigger ordering and idempotent MYRA credit.
5. Run two-user authenticated E2E in an isolated healthy staging database: legitimate answers, feedback, pass/fail, concurrent edits, unauthorized grade edits, direct completion attempt, cross-account reads/updates, duplicate credit.
6. Verify 7/7 release gates and functional regressions; obtain explicit production approval, then schedule monitored migration and rollback.

## Hold conditions
Do not merge PR #63 or apply production migration while `MIGRATIONS_FAILED`, authenticated E2E, and compatibility checks remain unresolved. Do not enable real billing.

## Read-only evidence
`database/tests/pr63_assessment_myra_release_gates_readonly.sql`:
- PROD 2/7 gates passed.
- HOMOLOG 7/7 gates passed.

No production/staging mutation is authorized by this document.
