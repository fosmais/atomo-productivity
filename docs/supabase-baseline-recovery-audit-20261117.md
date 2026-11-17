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


## Core foreign-key dependency graph (verified in production, 2026-11-17)

The following constraints were inspected using `pg_constraint` and `pg_get_constraintdef`. They are a **partial graph**, not a full schema export:

- `auth.users(id)` → `public.plans.user_id` (ON DELETE CASCADE).
- `public.plans(id)` → `public.tasks.plan_id` (ON DELETE CASCADE).
- `auth.users(id)` → `public.tasks.user_id` and `public.events.user_id` (ON DELETE CASCADE).
- `auth.users(id)` → `public.myka_conversations.user_id` (ON DELETE CASCADE).
- `public.myka_conversations(id, user_id)` → `public.myka_messages(conversation_id, user_id)` (composite FK, ON DELETE CASCADE). The parent has UNIQUE(id, user_id).
- `auth.users(id)` → `public.myka_messages.user_id` (ON DELETE CASCADE).

Relevant checks: `events.ends_at > events.starts_at`; `tasks.status` permits `todo`, `in_progress`, `waiting`, `done`; `tasks.duration_minutes` is null or 5–1440; `myka_messages.role` permits `user` or `assistant`.

### Non-executable dependency-order proposal

1. Supabase-managed `auth.users` exists first.
2. Define `plans` and `myka_conversations` before their dependents.
3. Define `tasks`, `events`, and `myka_messages` with verified constraints.
4. Define remaining tables, indexes, grants and policies from a complete schema-only export; do not infer their definitions from names.
5. Only then replay existing migrations in order and compare resulting schema with production.

**Important:** This order alone is insufficient to reconstruct all 62 public tables. Do not generate or apply a migration from this partial graph.


## Production-wide RLS and privileges audit (2026-11-17)

Verified with read-only catalog queries:

- 62/62 `public` base tables have RLS enabled.
- 122 explicit policies across 44 distinct tables; 18 tables have no explicit policy.
- 310 constraints in `public` (including 82 foreign keys, 143 check constraints, 23 unique constraints).
- Of 18 no-policy tables, 17 have SELECT denied to both `anon` and `authenticated`, but allowed to `service_role`. These include server-side payment/billing, OAuth connection, support, and quota tables. **Preserve this server-only posture in the baseline.**
- The remaining no-policy table `public."VYRA"` has SQL SELECT grants to `anon` and `authenticated`, but RLS is enabled with no policies. Therefore those grants do **not** alone imply row visibility. Review its purpose before changing grants or policies.

Catalog queries:

```sql
select count(*) as tables,
       count(*) filter (where c.relrowsecurity) as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';
```

```sql
select c.relname as table_name,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
       has_table_privilege('service_role', c.oid, 'SELECT') as service_select
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname
  )
order by c.relname;
```

Do not auto-generate broad `GRANT SELECT` or permissive policies to make missing tables work. Grants and RLS are separate controls.


## Executed parity smoke-test results (2026-11-17)

Read-only catalog aggregate query was executed against all three environments:

| Metric | Production | Event preview | Finance preview |
|---|---:|---:|---:|
| Public base tables | 62 | 5 | 27 |
| RLS-enabled tables | 62 | 5 | 27 |
| Explicit RLS policies | 122 | 10 | 67 |
| Public constraints | 310 | 27 | 133 |

These are **inventory counts only**, not proof of policy semantic parity, matching DDL, or successful migration replay. Both preview branches remain structurally incomplete. Do not modify production or use these previews to approve the baseline.

Read-only aggregate used:

```sql
select count(*)::int as tables,
       count(*) filter (where c.relrowsecurity)::int as rls_enabled,
       (select count(*)::int from pg_policies where schemaname='public') as policies,
       (select count(*)::int from pg_constraint con
        join pg_namespace n2 on n2.oid=con.connamespace
        where n2.nspname='public') as constraints
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r';
```

Next gate: identify first failing migration from branch logs, then export and compare complete DDL including security privileges before constructing an executable baseline.


## Migration-history fork confirmed (2026-11-17)

Read-only inspection of `supabase_migrations.schema_migrations` in three projects confirms:

- All three start with version `20261030174834` (`autopilot_transactional_reservation`).
- Production's **second** registered migration is `20261030195840` (`autopilot_unique_task_reservation_guard`).
- Event preview's **second** registered migration is `20261101170550` (`myryra_homolog_event_schema_baseline`), followed by event-specific test harnesses.
- Finance preview's **second** registered migration is `20261108015537` (`finance_isolated_rls_harness`), followed by Finance-specific test harnesses.

Thus both existing previews have **divergent migration histories**, not merely fewer tables. A direct merge/rebase/reset is not an approved recovery action: investigate migration reconciliation and data-loss risk first.

A recent `postgres_logs` query in the Event preview returned no matching ERROR/migration messages in the available default log window. This does **not** establish the original failure statement.

**Next gate:** recover historical branch creation/build error from a reliable source, and compare complete Git migration files to production migration history before drafting an executable initial baseline.


## Initial migration dependency preflight executed (2026-11-17)

File: `docs/sql/supabase-migration-dependency-preflight.sql`.

The preflight checks 13 required columns across `public.tasks` and `public.events`, referenced by the first AutoPilot function and the second AutoPilot index migration.

| Environment | Missing required columns |
|---|---:|
| Production | 0 |
| Event preview | 5 |
| Finance preview | 0 |

Event preview missing: `tasks.id`, `tasks.user_id`, `tasks.title`, `tasks.completed`, `tasks.duration_minutes`. The table itself is absent.

This is a **current-state dependency failure**, not proof of the historical failed statement. The function-creation migration can be registered before the referenced tables exist because PL/pgSQL statement planning is deferred; the subsequent `CREATE INDEX ... ON public.events` requires the events table at execution time. Verify branch-build logs for exact historical failure.

GitHub repository inspection confirmed `supabase/migrations` is a directory, but its file inventory was not obtained. Do not assume that the production migration registry and tracked Git files match.


## Migration registry refreshed (2026-11-17, later check)

Read-only `count(*)` against `supabase_migrations.schema_migrations` returned:

| Environment | Registered migrations | Latest version |
|---|---:|---|
| Production | 45 | 20261113182502 |
| Event preview | 9 | 20261104155422 |
| Finance preview | 29 | 20261116230713 |

Earlier documentation mentioned 37 production migrations; that figure is **superseded** by this later observation. This does not establish when or why the count changed. Compare the registry with Git-tracked files before attempting repair. The GitHub migration inventory script has not yet been executed, so the file-to-registry comparison remains open.


## Exact migration version-set reconciliation (2026-11-17)

Executed read-only queries against all three `supabase_migrations.schema_migrations` registries, comparing **version strings** rather than migration names:

| Comparison with production (45 registered versions) | Event preview | Finance preview |
|---|---:|---:|
| Shared versions | 1 | 1 |
| Preview-only versions | 8 | 28 |
| Production versions absent in preview | 44 | 44 |

The sole shared version is `20261030174834` (`autopilot_transactional_reservation`).

**Important distinction:** a missing migration-history record does not, by itself, prove the corresponding table/column is absent. Conversely, inserting migration-history rows cannot create missing schema objects. Structural parity and migration replay need separate verification.

The version-set comparison was executed using the connected Supabase database tools. Git repository migration file inventory is still unverified, and no migration DDL or schema mutation was executed.


## GitHub Actions migration inventory result (2026-11-17)

The read-only GitHub Actions workflow **completed successfully**: [run 44114722406](https://github.com/fosmais/atomo-productivity/actions/runs/44114722406). This validates that the inventory/comparison script ran, **not** that database migration replay succeeds.

Comparing SQL filename version identifiers in the Git tree of `feat/myryra-mvp2-mika-agent-engine` to Supabase migration registries:

| Environment | Registry versions with no matching Git SQL version | Git SQL versions not in registry |
|---|---:|---:|
| Production | 43 | 7 |
| Events preview | 9 | 9 |
| Finance preview | 29 | 9 |

Six additional legacy SQL files use an 8-digit date prefix and were **excluded** from the 14-digit version matching:
- `20261101_billing_queue_atomic_claim.sql`
- `20261101_billing_queue_finalize.sql`
- `20261101_billing_reconciliation_queue.sql`
- `20261104_event_categories.sql`
- `20261104_event_category_permissions.sql`
- `20261104_event_reminders.sql`

**Release gate:** Do not mark migration versions as applied to silence drift. First retrieve/reconstruct missing baseline DDL, establish clean-replay ordering in an isolated environment, and verify core schema, constraints, RLS and policies before any production proposal.


## MIKA Teacher baseline dependency verification (2026-11-17)

Read-only `to_regclass` checks against all three Supabase environments:

| Table | PROD | Events preview | Finance preview |
|---|---|---|---|
| `public.myryra_journeys` | exists | **missing** | exists |
| `public.mika_teacher_sessions` | exists | **missing** | exists |
| `public.mika_teacher_messages` | exists | **missing** | exists |

Source migration `supabase/migrations/20261112235900_mika_teacher_sessions.sql` contains an explicit preflight that raises an exception when `public.myryra_journeys` is missing. Thus Events preview cannot replay this migration successfully until Journey's baseline exists.

**Caution:** table existence is not proof of correct schema, grants, RLS, policy parity, migration replay, or feature readiness. Do not replay the Teacher migration in Events until Journey DDL, constraints and ownership policies have been restored and verified. No database changes were made during these checks.


## Isolated Journey → MIKA Teacher SQL replay verified (2026-11-17)

GitHub Actions [run 44119229116](https://github.com/fosmais/atomo-productivity/actions/runs/44119229116) completed **successfully** on commit `54baeda`.

Individual successful steps confirmed via workflow job metadata:
1. Initialize disposable PostgreSQL 16 service.
2. Create minimal Supabase auth role/table/function stubs.
3. Execute `docs/sql/myryra-journey-isolated-baseline-candidate.sql` followed by `supabase/migrations/20261112235900_mika_teacher_sessions.sql`.
4. Assert all three tables exist with RLS enabled, four Journey policies, and Teacher→Journey foreign key.

This verifies **isolated SQL replay with mocked auth**, not a real Supabase branch migration, auth.uid() isolation with multiple users, end-to-end product behavior, or complete schema parity. The candidate SQL remains under docs/sql and has not been applied to any Supabase environment.


## Two-user Journey RLS isolation smoke passed (2026-11-17)

GitHub Actions [run 44119562357](https://github.com/fosmais/atomo-productivity/actions/runs/44119562357) completed successfully on commit `2c079287`. The dedicated step **Verify two-user Journey RLS isolation** passed after isolated Journey→MIKA Teacher replay and schema assertions. The test file `docs/sql/journey-two-user-rls-smoke.sql` checks own-row visibility, cross-user read/update/delete isolation, and rejection of a forged-owner insert using simulated JWT claims.

The migration audit, regression checks and MVP1 quality/security workflows also passed on that commit. These results do **not** establish real Supabase Auth integration or full MVP2 schema replay. No existing database was modified.
