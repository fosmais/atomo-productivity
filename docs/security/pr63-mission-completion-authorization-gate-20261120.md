# PR #63 — Mission completion authorization gate

Date: 2026-11-20. **Read-only evidence** from PostgreSQL catalogs in PROD and MVP2 homologation; no mutations.

## Confirmed effective privileges and RLS

| Table | PROD authenticated UPDATE / DELETE | HOMOLOG authenticated UPDATE / DELETE | RLS enabled both |
| --- | --- | --- | --- |
| myryra_journeys | true / true | false / false | yes |
| myryra_journey_missions | true / true | false / true | yes |
| myryra_journey_myra_ledger | false / false | false / false | yes |

RLS is not FORCE-enabled in either environment for these tables. Authenticated owner policies on missions check the journey owner but do not constrain mission status transitions. Production does not have the two educational completion guards observed in homologation.

## Security hypothesis (not yet exploited or confirmed)

An authenticated owner may be able to UPDATE their own educational mission to status=completed without a persisted passing assessment, causing the AFTER status-change trigger to issue MYRA. RLS ownership would still prevent cross-owner changes. This hypothesis must be tested only with authorized synthetic test accounts and isolated data, not production accounts or records.

## Two-account test matrix

- A cannot view, modify, delete or create data under B's journey; B cannot view A's ledger.
- A's direct INSERT with status completed is rejected where intended.
- A's direct UPDATE to completed without passing educational assessment is rejected where intended.
- Legitimate server-mediated completion with the current assigned exercise succeeds exactly once.
- Retry, downgrade/upgrade status and parallel completion never duplicate MYRA.
- A cannot physically delete journey/mission while preserving earned MYRA is required.
- All outcomes are captured with HTTP status, SQLSTATE where available, count/sum of ledger before and after, and no personal data.

## Release gates

1. Agree on desired mission status authorization for educational and non-educational missions.
2. Validate effective grants, policies and trigger enforcement against two authenticated synthetic users in isolated environment.
3. Rehearse least-privilege migration on production-equivalent isolated PostgreSQL, with rollback plan and regression checks.
4. No merge, DDL, migration or production deployment without explicit approval.
