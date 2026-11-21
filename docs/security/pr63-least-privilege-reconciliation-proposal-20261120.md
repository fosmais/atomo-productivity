# PR #63 — Proposed least-privilege reconciliation (review only, 2026-11-20)

## Verified current privileges (read-only catalog checks)
| Authenticated operation | PROD | HOMOLOG |
|---|---|---|
| Journey UPDATE | yes | no |
| Journey DELETE | yes | no |
| Mission UPDATE | yes | no |
| Mission INSERT | yes | yes |
| MYRA ledger UPDATE/DELETE | no | no |

All three tables have RLS enabled. HOMOLOG journey RLS policies are SELECT/INSERT only; mission policies cover SELECT/INSERT/UPDATE/DELETE. PROD owner journey policies cover all four operations.

## Proposed change set — not yet authorized or applied
1. **Mission completion:** keep direct `authenticated` UPDATE of mission `status` disallowed. Introduce or verify a narrowly scoped server-authorized completion operation that checks authenticated owner, latest assigned exercise, passing assessment bound to the same answer and mission, and idempotent credit. Never trust client-supplied `passed` or `score`.
2. **Journey editing:** audit API endpoints and allowed editable columns. Permit only owner-scoped non-sensitive updates with RLS USING and WITH CHECK, after validating no unsafe owner/identity field updates. Prefer column-level grants where feasible.
3. **Journey deletion:** prefer soft-delete/archive to preserve missions, assessment evidence and MYRA ledger. Do not enable physical DELETE merely for parity with PROD.
4. **Mission editing:** separate benign fields from `status` and `journey_id`. Prevent reassignment and bypass of educational assessment. Confirm actual API requirements before granting any UPDATE.
5. **Migration history:** do not reset/rebase a `MIGRATIONS_FAILED` branch without its exact failure details and a data-preserving forward plan.
6. **Verification:** test legitimate owner editing, cross-owner isolation, failed assessment, approved completion, idempotent credit and archival with two real Supabase Auth identities. Rehearse on disposable clone and obtain explicit approval before DDL/permissions/PROD rollout.

## Risk / status
The PROD mission UPDATE grant combined with absence of assessment guards is a **potential bypass** requiring authenticated E2E proof, not a demonstrated exploit. The HOMOLOG missing UPDATE grants are confirmed by catalog, but runtime app behavior is not tested. No database changes were made.
