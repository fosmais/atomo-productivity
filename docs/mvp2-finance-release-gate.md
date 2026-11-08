# MYRYRA MVP2 Finance — release gate (2026-11-08)

## Confirmed in isolated Supabase staging
- Nine Finance tables; 28 RLS policies; 21 indexes.
- Seven Finance staging migrations recorded, including initial RLS harness and index reconciliation.
- Two versioned two-user RLS SQL regressions executed successfully with transaction rollback.
- Synthetic user Finance entries, subscriptions and notifications: zero after tests.
- Staging-only SQL files live under `docs/sql/staging-migrations/`, not `supabase/migrations/`.
- The clean-replay GitHub Actions job successfully applied all seven migrations to disposable PostgreSQL 16 and asserted nine tables, 28 policies, 21 indexes, two soft-delete columns and RLS enabled on every Finance table. Workflow: `.github/workflows/finance-staging-replay.yml`; initial passing run 42442107105, commit 529aad414dd6d4f199508b0eb3954867a7346a88.
- Extended clean replay also ran both two-identity RLS SQL regressions with transaction rollback and verified zero persistent fixtures: run 42442430247, commit de7e52da287e414531c9fe9f0edf6a50b6cff391. Every job step passed.
- The MYRYRA regression checks and MVP1 Quality and Security workflows both succeeded on commit de7e52da287e414531c9fe9f0edf6a50b6cff391.
- Vercel Preview override on branch `test/mvp2-finance-wallet-regression` points to isolated staging Supabase `xanavauqzsrgvdfhcrsm`; checkout and entitlements flags are false.

## BLOCKERS — do not merge or promote to production
1. Complete authenticated UI E2E in the protected Vercel Preview (SSO enabled); **not yet performed**.
2. Verify actual Finance CRUD, soft-delete/restore and persistence across reload using test accounts on isolated staging. Include negative cross-user access checks from the application.
3. Review and separately authorize any production Finance schema changes; the staging-only SQL is intentionally not an automatic production migration.
4. Keep real billing/checkout/entitlements disabled until separately approved.

## Safety
- Clean replay is a PostgreSQL schema/RLS migration smoke test with a minimal auth stub, **not** a full Supabase service or authenticated browser E2E test.
- No production SQL writes or deployment authorized by these test results.
- Existing staging branch incurs hourly compute; delete when tests are finished and approved.
