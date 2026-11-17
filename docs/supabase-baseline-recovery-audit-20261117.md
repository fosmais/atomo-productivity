# MYRYRA — Supabase baseline recovery audit (2026-11-17)

Issue: #21 (related: #8). This is an **audit**, not a deployable baseline migration.

## Verified observations (read-only MCP queries)

- Production Supabase project: `qothgddrvrpeqsprslqk`, 62 public base tables.
- Preview `myryra-mvp1-event-homolog`: 5 public base tables; `tasks`, `plans`, `favorites` missing; status `MIGRATIONS_FAILED`.
- Preview `myryra-mvp2-finance-homolog`: 27 public base tables; `favorites`, `myka_conversations`, `google_calendar_connections` missing; status `MIGRATIONS_FAILED`.
- First registered migration `20261030174834_autopilot_transactional_reservation` defines a function referencing `public.tasks` and `public.events`; it does not create those tables.
- Second registered migration `20261030195840_autopilot_unique_task_reservation_guard` creates a unique index on `public.events(user_id, notes)`.
- Later migration `20261030212727_mvp1_enforce_optional_mfa_on_user_data` adds policies to pre-existing tables including `public.plans`, `public.tasks`, and `public.events`.
- The first *exact* failed statement is **not yet verified** from branch-build logs. Do not label the first function migration as the proven failure.
- Finance preview has manually staged harness migrations; it is not evidence of complete reproducibility.

## Read-only diagnostic queries

Run each query independently against production and a disposable preview; compare structure only, **not user records**.

```sql
select table_name
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;
```

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
```

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;
```

## Release gate

1. Obtain exact first migration failure from Supabase branch build logs.
2. Export **schema only** (no data, credentials, or auth users); compare Git migration inventory with actual schema.
3. Reconstruct an initial baseline in dependency order: types/extensions, core tables, constraints, indexes, functions, grants, RLS and policies. Review SECURITY DEFINER functions and owner checks.
4. Validate locally in an empty database, then in a new isolated preview **only after cost confirmation**, checking migration history, table parity, RLS, and authenticated cross-user isolation.
5. Keep production schema and current app unchanged. Do not merge a speculative baseline or enable Finance trash/payment flags.

This audit file is intentionally non-executable documentation.
