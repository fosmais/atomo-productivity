# MYRYRA — Migration collision dependency map (2026-11-18)

**Scope:** six SQL files in `supabase/migrations` with duplicated 8-digit version prefixes. Based on inspection of the actual SQL in the audit branch. This is a **planning document**, not authorization to apply or rename migrations. No database writes.

## Prefix `20261101`: Asaas billing queue

| File | Objects/behavior | Required prior objects |
| --- | --- | --- |
| `20261101_billing_reconciliation_queue.sql` | Creates `public.billing_reconciliation_jobs`, pending index, RLS enabled, revokes anon/authenticated | Standard PostgreSQL identity, no application table prerequisite |
| `20261101_billing_queue_atomic_claim.sql` | Creates `public.claim_asaas_reconciliation_job(integer)` SECURITY DEFINER, service_role-only, row locking with SKIP LOCKED | `public.billing_reconciliation_jobs`; Supabase `auth.role()` |
| `20261101_billing_queue_finalize.sql` | Creates `enqueue_asaas_reconciliation_event` and `complete_asaas_reconciliation_job`, service_role-only | `public.billing_reconciliation_jobs`; Supabase `auth.role()` |

**Partial order:** queue table **before** atomic claim and finalize; the latter two do not require an order relative to one another according to their SQL. Queue is staging-only; SQL explicitly states it is not proof of payment or entitlement. No real charges should be enabled as a consequence of this work.

## Prefix `20261104`: event categories/reminders

| File | Objects/behavior | Required prior objects |
| --- | --- | --- |
| `20261104_event_categories.sql` | Adds `events.category`, check constraint and partial index on `user_id,category,starts_at` | `public.events` with `user_id`, `starts_at`, `deleted_at` |
| `20261104_event_category_permissions.sql` | Grants category UPDATE and owner-scoped UPDATE RLS policy | **Category migration above**, `events.user_id`, `events.deleted_at`, `auth.uid()` |
| `20261104_event_reminders.sql` | Creates `public.event_reminders`, three owner policies, indexes, cleanup trigger on event soft deletion | `public.events(id,user_id,starts_at,deleted_at)`, `auth.users`, `auth.uid()` |

**Partial order:** event foundation **before** all three; categories **before** category permissions. Reminders are independent of categories in the inspected SQL.

## Registry cross-check

No exact `20261101` or `20261104` version was recorded in PROD or either inspected preview branch. The older preview contains **different 14-digit version entries with similar feature names**. Version/name similarity is not SQL equivalence. Compare full function bodies, constraints, policies and grants before considering any migration marked as already applied.

## Release-safe resolution proposal

1. Preserve original six files and their checksums until their relationship to deployed database objects is established.
2. Determine intended ordering and assign distinct 14-digit versions only in an explicitly reviewed migration plan. Do not silently rename applied files or repair registries.
3. Replay in disposable PostgreSQL/Supabase fixtures and test permission/tenant boundaries, concurrency/idempotency, and calendar soft-delete cleanup.
4. Compare resulting schema against intended Supabase preview; obtain explicit approval for any actual environment changes.

**Status:** dependency mapping completed; migration filename CI deliberately blocks release; no Supabase environment changed.
