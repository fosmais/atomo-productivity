# MYRYRA Finance staging-only migration replay

These SQL files are **not production migrations**. They are retained under `docs/sql/staging-migrations` to prevent accidental automatic application in production.

## Prerequisites
- A **new, disposable Supabase database** with the `auth` schema installed. Do not use an existing project or production database.
- An authenticated `psql` connection to that disposable database.
- No existing `public.myryra_finance_%` tables; verify before running.
- This is a manual operator runbook, not evidence that a clean replay has passed.

## Preflight (run manually)

```sql
SELECT current_database(), current_user;
SELECT count(*) AS existing_finance_tables FROM information_schema.tables
 WHERE table_schema='public' AND table_name LIKE 'myryra_finance_%';
-- Must be 0; abort otherwise.
```

## Apply in strict version order

Run these files individually using `psql -v ON_ERROR_STOP=1 -f <file>` and stop immediately on any failure:

1. `20261108015537_finance_isolated_rls_harness.sql`
2. `20261108023702_mvp2_finance_edit_trash_staging.sql`
3. `20261108024538_mvp2_finance_balances_goals_planned_staging.sql`
4. `20261108024810_mvp2_finance_remaining_four_tables_staging.sql`
5. `20261108025045_mvp2_finance_constraints_parity_staging.sql`
6. `20261108025147_mvp2_finance_rls_index_parity_staging.sql`
7. `20261108025300_mvp2_finance_active_owner_index_staging.sql`

Do **not** run Supabase's automatic production migration deployment with these files. This sequence reconstructs the Finance subset only, not the complete MYRYRA app schema (plans, tasks, events and other dependencies).

## Postflight assertions

```sql
SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'myryra_finance_%';
SELECT count(*) AS policies FROM pg_policies WHERE schemaname='public' AND tablename LIKE 'myryra_finance_%';
SELECT count(*) AS indexes FROM pg_indexes WHERE schemaname='public' AND tablename LIKE 'myryra_finance_%';
SELECT count(*) AS soft_delete_columns FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'myryra_finance_%' AND column_name='deleted_at';
```

Expected for the reconstructed Finance subset: **9 tables, 28 RLS policies, 21 indexes, 2 deleted_at columns**. Run both SQL RLS regression scripts in `docs/sql/` after replay and confirm no synthetic data persists.

**Release gate:** An operator must capture actual clean-replay results, run authenticated UI E2E behind Vercel SSO, and approve any production-specific migration separately. Never infer production readiness from a static file audit.
