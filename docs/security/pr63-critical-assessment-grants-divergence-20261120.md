# PR #63 — Critical assessment column grants divergence (2026-11-20)

Read-only checks with `has_column_privilege('authenticated', ..., 'UPDATE'/'INSERT')` on `public.myryra_journey_learning_progress`:

| Column | PROD UPDATE/INSERT | HOMOLOG UPDATE/INSERT |
|---|---|---|
| answer | true / true | false / false |
| feedback | true / true | false / false |
| assessment_score | true / true | false / false |
| assessment_passed | true / true | false / false |
| assessment_attempts | true / true | false / false |
| owner_id | true / true | false / false |
| mission_id | true / true | false / false |

Both environments block direct authenticated INSERT/UPDATE of `myryra_journey_myra_ledger`. Both have owner-scoped learning-progress RLS; RLS restricts ownership, **not which grade values the owner can write**. The API `PUT /api/journeys/learning` and feedback evaluation route already perform privileged server-side writes.

**Security concern:** PROD grants permit authenticated clients to write assessment grading columns for their own rows, potentially forging passing grades. PROD also permits direct mission status UPDATE and lacks the HOMOLOG assessment guards. This is a potential MYRA award bypass chain, **not a demonstrated authenticated exploit**.

**Remediation proposal (NOT applied):**
1. Determine any other direct-client writes to learning progress; retain SELECT as needed.
2. Revoke authenticated INSERT/UPDATE for server-owned grade and feedback fields, and avoid blanket grants. Keep server-controlled answer saving via authorized API.
3. Ensure assessment completion is guarded in the database and tied to the current assigned exercise, latest answer, authenticated owner and passing score.
4. Test direct client grade INSERT/UPDATE rejection, legitimate answer save, MIKA feedback, concurrent edit, mission completion and idempotent ledger under two real authenticated users in staging.
5. Deploy only via reviewed, forward-only migration with explicit approval, rollback plan, and production verification. Do not reset or rebase the failed homolog branch blindly.

No database writes or production changes were made.
