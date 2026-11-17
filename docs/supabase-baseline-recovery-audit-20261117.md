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


## MIKA Teacher two-user RLS smoke passed (2026-11-17)

GitHub Actions [run 44120541177](https://github.com/fosmais/atomo-productivity/actions/runs/44120541177) on commit `e6139aca` completed **successfully**. The job's dedicated step **Verify two-user MIKA Teacher RLS isolation** passed, alongside Journey two-user isolation, Journey→Teacher SQL replay, schema assertions, and the separate migration inventory, regression, and MVP1 quality workflows.

Test source: `docs/sql/teacher-two-user-rls-smoke.sql`. Checks Teacher session/message visibility and deletion isolation for two simulated JWT users, and attempts cross-owner Journey association. **Limit:** This test uses a disposable PostgreSQL database and simulated `auth.uid()`; it is not a real Supabase Auth, API, mobile or production test. The broader Supabase migration baseline remains unrecovered.


## Stronger Teacher cross-owner negative tests passed (2026-11-17)

GitHub Actions [run 44121869217](https://github.com/fosmais/atomo-productivity/actions/runs/44121869217), commit `0eb12f5d`, passed the Journey→Teacher SQL replay, two-user Journey RLS and two-user Teacher RLS steps. The updated Teacher test now uses a deterministic **known foreign Journey UUID** to attempt a direct cross-owner session insert (rather than `INSERT ... SELECT` from an RLS-invisible Journey), and checks that cross-user rescheduling updates zero rows. The separate Supabase migration inventory workflow also passed. At the time of this note, regression and MVP1 quality workflows were still running.

Scope remains disposable PostgreSQL with mocked auth; real Supabase Auth and full MVP2 baseline parity have not been validated.


## Effective Teacher role grants smoke passed (2026-11-17)

GitHub Actions [run 44122424796](https://github.com/fosmais/atomo-productivity/actions/runs/44122424796), commit `1b91f23d`, completed **successfully**. Job metadata confirms that all three steps passed: **Verify two-user Journey RLS isolation**, **Verify two-user MIKA Teacher RLS isolation**, and **Verify anonymous and authenticated role grants**. The latter asserts anonymous SELECT denial; authenticated read access; client-side Teacher message write denial; protected Teacher session field update denial; and permission to update `scheduled_at`.

This remains an isolated PostgreSQL test with mocked Supabase Auth. It does not verify real Supabase authentication, API gateway grants, full database migration history, or application behavior.


## 2026-11-17: Teacher owner reschedule / client message denial passed

Commit `84005e7` passed all four workflows: isolated SQL [44123191819](https://github.com/fosmais/atomo-productivity/actions/runs/44123191819), migration audit 44123192068, MYRYRA regression 44123191829, MVP1 quality/security 44123191980. The Teacher two-user test now asserts an owner can reschedule a session and authenticated clients cannot directly insert Teacher messages.

Read-only `list_branches` confirmed that existing preview branches `myryra-mvp1-event-homolog` and `myryra-mvp2-finance-homolog` both remain `MIGRATIONS_FAILED` (though their projects are ACTIVE_HEALTHY). Neither is a clean full-baseline candidate for real Supabase Auth testing. Do not mutate these previews or create a paid branch without an explicit decision. Real Supabase Auth and full MVP2 baseline replay remain outstanding.


## Journey candidate fail-closed replay verified (2026-11-17)

GitHub Actions [run 44124360467](https://github.com/fosmais/atomo-productivity/actions/runs/44124360467), commit `99eacd7`, completed successfully. The workflow explicitly attempted to replay the Journey candidate after initial application, required the exact expected preflight failure, and verified the count of public base tables was unchanged. Two-user Journey RLS, two-user Teacher RLS, and role-grant assertions passed in the same job. The migration inventory audit also passed. This proves a narrow isolated fail-closed property, **not** full Supabase migration reproducibility or absence of all schema drift.


## Seven-table core baseline gate (2026-11-17)

Added `docs/sql/myryra-core-baseline-readonly-gate.sql` (commit `da825ea`). The read-only gate checks 27 key columns across `plans`, `tasks`, `events`, `favorites`, `myka_conversations`, `myka_messages`, and `google_calendar_connections`, including types and nullability. Executed the equivalent catalog-only summary against all three Supabase projects:

| Environment | OK | Missing | Type/nullability mismatch |
| --- | ---: | ---: | ---: |
| PROD | 27 | 0 | 0 |
| Events preview | 9 | 18 | 0 |
| Finance preview | 14 | 13 | 0 |

The 27-column gate is a **subset**, not full DDL/schema parity. Neither preview is ready for full MVP2 replay. No databases were changed. Next: recover versioned foundational table definitions and their RLS/constraints in a separate, isolated migration chain; do not mark registry history applied without executing migrations.


## Core constraint and RLS drift (2026-11-17)

Added `docs/sql/myryra-core-constraints-rls-readonly.sql` (commit `526f714`). Read-only catalog inspection of seven foundational tables:

| Environment | Present tables / 7 | Constraints | Policies |
| --- | ---: | ---: | ---: |
| PROD | 7 | 31 | 24 |
| Events preview | 2 | 8 | 5 |
| Finance preview | 3 | 13 | 12 |

All present tables in this subset have RLS enabled. In PROD, `google_calendar_connections` has RLS enabled and zero explicit policies; do **not** infer client access or copy token grants blindly. The PROD core includes composite `myka_messages(conversation_id,user_id)` → `myka_conversations(id,user_id)` FK, `tasks.plan_id` → `plans.id` FK, and favorites FKs to tasks/events. This catalog snapshot is not an executable reconstruction and does not prove semantic equivalence of preview policies. No DB mutation was performed.


## Core indexes and event-overlap trigger inventory (2026-11-17)

Added `docs/sql/myryra-core-indexes-triggers-readonly.sql` (commit `4066ab3`). Read-only PROD catalog inspection found 17 indexes across the seven foundational tables, including:
- Events: per-user start/category/deleted indexes and a partial unique index preventing duplicate AutoPilot-generated events by `(user_id, notes)`.
- Favorites: per-user chronological index and separate partial unique indexes for task/event targets.
- MIKA conversations/messages: conversation update ordering and message chronological ordering indexes.
- Tasks: per-user soft-delete index.

The only trigger on these seven tables is `myryra_guard_blocking_event_overlap`, BEFORE INSERT/UPDATE on `events`. Its function serializes checks per user with an advisory transaction lock, rejects overlapping active blocking events, validates intervals, and deliberately preserves legacy overlaps when an update does not change owner or interval. This is business-critical behavior and must be preserved in any reconstructed baseline. No SQL was applied to any database.


## Critical index and calendar-trigger parity (2026-11-17)

Added `docs/sql/myryra-core-index-trigger-parity-readonly.sql` (commit `4ad7e81`), checking 18 named PROD indexes and the calendar conflict trigger/function.

Read-only preview inventory:
- Events preview has only 3 of the required core index names in this subset: `events_pkey`, `events_user_category_idx`, `myka_messages_pkey`.
- Finance preview has 8: `events_autopilot_task_once_per_user_idx`, `events_pkey`, `events_user_category_idx`, `events_user_deleted_at_idx`, `events_user_start_idx`, `plans_pkey`, `tasks_pkey`, `tasks_user_deleted_at_idx`.
- Neither preview returned the `myryra_guard_blocking_event_overlap` trigger in its catalog inventory. PROD has the trigger on events for BEFORE INSERT and BEFORE UPDATE, using the function `public.myryra_guard_blocking_event_overlap()`.

The gate is diagnostic only; index-name presence does not prove identical definitions. Trigger/function behavior must be compared by definition/checksum and tested for overlap, concurrent inserts and legacy updates before any replay. No database was changed.


## Calendar overlap guard candidate and isolated smoke (2026-11-17)

Created:
- `docs/sql/myryra-calendar-overlap-guard-candidate.sql` (commit `781dd5d`): candidate recreation of the PROD BEFORE INSERT/UPDATE trigger and function, guarded by a preflight requiring the events table.
- `docs/sql/myryra-calendar-overlap-guard-smoke.sql` (commit `b3198c0`): disposable-Postgres behavior tests for blocking overlap rejection, non-blocking overlap allowance, soft-deleted event allowance, unchanged legacy overlap update, and invalid interval rejection.
- `.github/workflows/calendar-overlap-guard-smoke.yml` (commit `f68b2bb`): runs the smoke script on PostgreSQL 16.

**Not yet validated:** workflow execution result; concurrent two-session insertion race; equivalence of function definition/checksum against PROD; complete core baseline. This candidate is not applied to any Supabase project.


## Calendar overlap guard behavior smoke passed; concurrency test added (2026-11-17)

The isolated PostgreSQL 16 workflow [run 44125959980](https://github.com/fosmais/atomo-productivity/actions/runs/44125959980) passed the behavior smoke for overlap rejection, non-blocking/deleted event allowance, unchanged legacy overlap edits, and invalid interval rejection.

Added a second concurrent-insert test to `.github/workflows/calendar-overlap-guard-smoke.yml` (commit `551cc4d`). It launches two independent psql sessions attempting the same blocking interval for the same user and asserts exactly one succeeds and exactly one row remains. This new concurrency assertion is **pending CI execution**; no claim of concurrency test success yet. No Supabase project was changed.


## Calendar overlap guard concurrency test passed (2026-11-17)

Commit `551cc4d` workflow run [44126510886](https://github.com/fosmais/atomo-productivity/actions/runs/44126510886) completed successfully. Job metadata confirms both **Run overlap guard behavior smoke** and **Verify concurrent overlapping inserts serialize per user** passed. The concurrency test used two independent psql sessions inserting the same blocking interval for one user; exactly one insert succeeded and exactly one row remained. Journey SQL smoke, migration registry audit and MYRYRA regression checks also passed on this commit. MVP1 Quality and Security workflow was still in progress when checked.

This remains disposable PostgreSQL CI. It does not validate Supabase Preview parity, app/API behavior or complete baseline replay. No Supabase environment was modified.


## Core secondary-index candidate and smoke added (2026-11-17)

Added:
- `docs/sql/myryra-core-secondary-indexes-candidate.sql` (`20f9b4b`): 11 non-primary-key indexes reconstructed from PROD definitions. PK indexes are intentionally omitted because they belong in foundational table constraints.
- `docs/sql/myryra-core-secondary-indexes-smoke.sql` (`8c2a483`): creates disposable minimal table fixtures, applies candidate indexes, checks all 11 names exist and verifies duplicate event favorites are rejected.
- `.github/workflows/core-secondary-indexes-smoke.yml` (`e102b2f`): PostgreSQL 16 CI smoke.

This validates DDL syntax and a uniqueness invariant only after CI runs. It does not validate full production schema compatibility, all partial-index semantics, RLS, or the complete baseline. Candidate is not applied to Supabase projects.


## Core secondary-index smoke passed (2026-11-17)

Commit `e102b2f` passed all six workflows: core secondary-index smoke [44127116620](https://github.com/fosmais/atomo-productivity/actions/runs/44127116620), Journey SQL smoke 44127116658, calendar overlap guard smoke 44127116884, migration registry audit 44127116594, MYRYRA regression 44127116858, and MVP1 quality/security 44127116990. The secondary-index job's **Replay secondary indexes and assert uniqueness** step passed on PostgreSQL 16.

This confirms the candidate DDL executes against minimal disposable fixtures and the duplicate-favorite uniqueness assertion works. It is not a complete schema replay or preview validation; no Supabase database was changed.
