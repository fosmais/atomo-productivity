# MYRYRA MIKA Customer Support — release runbook

## Runtime flags

The support intake is authenticated and creates a ticket before attempting any AI response.

Required server-side Vercel environment variables:
- `RESEND_API_KEY`: Resend API key (never expose to client).
- `MIKA_EMAIL_ENABLED=true`: explicitly enables outbox delivery.
- `SUPPORT_INBOX_EMAIL`: optional; defaults to `support@myryra.com`.
- `CRON_SECRET`: secret used by Vercel Cron to authenticate the worker.
- `OPENAI_API_KEY`: existing server-side OpenAI key.
- `MIKA_SUPPORT_AI_ENABLED=true`: explicitly enables MIKA's support triage/reply.
- `MIKA_SUPPORT_MODEL`: optional; defaults to `gpt-4.1-mini`.

Keep the AI flag disabled until the isolated Preview passes the acceptance suite. The AI path additionally requires the authenticated user to have current legal acceptance. When the AI feature is disabled, consent is missing, the model fails, or the issue is outside the approved knowledge scope, the ticket remains open for human support.

## Delivery

Vercel Cron calls `/api/cron/support-email-outbox` every five minutes. The endpoint:
- requires `Authorization: Bearer <CRON_SECRET>`;
- is disabled unless `MIKA_EMAIL_ENABLED=true` and `RESEND_API_KEY` are present;
- claims pending rows with a compare-and-set status update;
- sends customer acknowledgements only to verified account email addresses;
- uses Resend idempotency keys so retries of the same outbox row do not send duplicates;
- recovers claims abandoned for more than ten minutes using a processing timestamp;
- retries provider failures up to five attempts;
- records sent/failed status without logging message contents or credentials.

## Safety and privacy

- Customer tickets are created server-side from the authenticated session; client-supplied user IDs are rejected.
- The follow-up migration `20261121050000_support_server_only_ticket_creation.sql` removes direct INSERT/UPDATE/DELETE grants for authenticated users and drops the former INSERT policy, including on databases where the core migration was already applied. Verify this behavior in an isolated branch before production migration.
- The support throttle is independent from MIKA/Concierge AI quotas (5 tickets/hour and 10/day). Migration `20261121060000_support_atomic_ticket_rate_limit.sql` installs the server-only `create_support_ticket_limited` RPC with a transaction-scoped per-user advisory lock, preventing concurrent requests from bypassing limits. The route requires this migration; without it, ticket creation fails closed with HTTP 503.
- The AI is restricted to basic product guidance. Account, security, billing, refunds, personal-data and out-of-scope cases are escalated.
- The AI receives ticket text only after checking current legal acceptance.
- No production environment flags should be enabled until Preview verification is complete.

## Operational validation

1. Submit a synthetic ticket in Preview.
2. Confirm one `support_tickets` row, one `ticket_created` outbox row and, when the account email is verified, one `ticket_acknowledgement` row.
3. Call the cron endpoint with a synthetic secret and verify unauthorized requests return 401.
4. With email disabled, verify the worker reports disabled and does not mutate the queue.
5. With a valid Resend test key, verify one email, one sent row, and no duplicate on the next run.
6. Enable MIKA AI only in isolated Preview and test a known FAQ, an out-of-scope billing request, missing consent, and provider timeout.
7. Verify cross-user reads are denied, direct client ticket INSERT is rejected, and production flags remain unchanged.
8. Confirm the `/api/support/replies` endpoint returns only the authenticated owner’s replies and labels AI vs human messages in the widget.


## Isolated Preview guard

The customer-support Preview branch currently uses deliberately invalid Supabase URL, publishable-key and admin-key placeholders. This prevents the Preview from inheriting the shared production Supabase environment. Replace these three values only after a dedicated Supabase homologation branch exists and its support schema is verified. Keep email and MIKA AI feature flags set to `false` until synthetic end-to-end checks pass.

## Read-only compatibility audit — 2026-11-21

A read-only inspection of the existing MYRYRA Supabase production database confirmed the presence of `support_tickets`, `support_ticket_replies` and `support_email_outbox`. The current outbox event-type constraint allows `feedback_created` and `ticket_created` only; migration `20261121040000_support_outbox_recovery.sql` is therefore necessary before queuing `ticket_acknowledgement` messages. The existing outbox does not yet contain `processing_started_at`.

The current ticket RLS policy includes a historical authenticated INSERT policy, but a query of role-table grants did not return a corresponding authenticated INSERT grant. The server-only migration removes both permission paths defensively. This audit did not execute migrations or change production data. Validate the migration sequence on an isolated branch before promotion.

## Verification checkpoint — 2026-11-21

- Preview deployment `dpl_5a4DMsJuHJviJX3mXKv2PtQTiZBt` is READY after a successful build; the preceding deployment had 226/226 Node tests pass but failed TypeScript checking, which was corrected.
- All three existing Supabase homologation branches (`dzxyflpihdoizdiurnud`, `vzgahbceixjrdlqdtwoy`, `xanavauqzsrgvdfhcrsm`) report `MIGRATIONS_FAILED`. Read-only SQL confirmed that none contains `public.support_tickets`, `public.support_email_outbox`, or `public.create_support_ticket_limited`.
- Do not repurpose these branches or point Preview at production. Create a dedicated isolated support branch only after the required cost confirmation; apply support migrations in ascending order and test with synthetic users.
- The branch's automated tests currently verify source-level invariants, not real concurrent database transactions or Resend delivery. Those remain release blockers.

## Isolated SQL homologation checkpoint — 2026-11-21

- New paid isolated branch `myryra-mvp2-support-security-homolog` (`woqpzvqfaeqteiqpsaqi`), confirmed rate US$0.01344/hour. Four support migrations applied successfully; follow-up SQL hardening applied only to this branch.
- Privileges checked: authenticated cannot execute support creation RPC, INSERT, TRUNCATE, TRIGGER or REFERENCES; service_role can execute the RPC; authenticated SELECT is constrained by RLS.
- SQL transaction using `SET LOCAL ROLE service_role` created a ticket successfully; sixth sequential ticket was blocked after five. Eight parallel SQL requests yielded five committed tickets and three tool-level errors; this verifies the database cap in the observed run, but the error classifications and HTTP concurrency behavior remain unverified.
- Synthetic user and tickets were deleted; confirmed zero remaining. Isolated RLS owner read succeeded and cross-user read returned zero.
- RPC migrated to SECURITY INVOKER; direct SELECT on auth.users removed because service_role cannot read that table. FK still enforces user existence. Inherited authenticated TRUNCATE/TRIGGER/REFERENCES grants were revoked.
- Latest Preview deployment `dpl_2d8aznNVjfM7Amp6CpS1KxT3FQUd` on commit `316fdece7187c8603a4df7c3d121e1dfed4cd7c0` reached READY. Production unchanged.
- Outstanding: authenticated HTTP E2E, concurrent API requests, Resend sandbox, MIKA AI safety, Android regression, final release approval. Decommission the hourly-billed branch when homologation is complete.

## Branch synchronization investigation — 2026-11-21

- Production has 45 migration history entries; isolated support branch has 7, with only `autopilot_transactional_reservation` shared. The branch is `MIGRATIONS_FAILED` while its database is `ACTIVE_HEALTHY`.
- Rebase request returned success, but follow-up status remained `MIGRATIONS_FAILED` and the migration count remained 7. Do not claim synchronization succeeded.
- Supabase health advisors returned no lints. Security advisor reports four INFO `rls_enabled_no_policy` notices on service-only support tables; intentional unless access model changes.
- Next step: inspect Supabase Dashboard > Manage Branches > branch > View logs for the exact migration failure before reset/recreation. Do not merge branch into production. Do not point full-app Preview to this incomplete schema.

## Confirmed migration failure and recovery gate — 2026-11-21

- Retrieved `workflow_run_logs` from isolated Supabase project, run `6d7d0b99119f498eb39de241cca0cd9a`.
- Exact error: `2026/11/21 19:51:32 ERROR ERROR: relation "public.events" does not exist (SQLSTATE 42P01)` while applying `20261030195840_autopilot_unique_task_reservation_guard.sql` and creating `events_autopilot_task_once_per_user_idx`.
- Production has both `public.events` and the index. Isolated branch has neither; `public.tasks` and `public.profiles` are also missing there. The branch is therefore support-schema-only, not full-app homologation.
- The referenced migration file is not available at that exact path on the working branch or `main`. Before a reset, reconcile Supabase's 45 production migration records with the versioned migration files and restore the schema-creation dependency that must precede the AutoPilot index.
- Do not bypass the error with `CREATE TABLE events` placeholders or by silently skipping the index; do not merge this branch to production. Once migration provenance and order are fixed, recreate or reset a disposable isolated branch, verify all expected application tables, and repeat RLS, API, outbox, and Android tests.

## Baseline schema gap — verified 2026-11-21

- Read-only count of `public` base tables: production **63**, isolated branch **5**.
- Production migration history starts at `20261030174834_autopilot_transactional_reservation`, followed by `20261030195840_autopilot_unique_task_reservation_guard`; the latter references `public.events` absent on the branch. No earlier baseline-schema migration is present in the 45-record production migration history.
- Do not assume replaying those 45 migrations against an empty database can recreate the 63-table production schema. First obtain a sanitized schema-only baseline from the production project through an authorized schema export/CLI process, with no user data, secrets, or production credentials copied into Git. Compare schema dependencies, extensions, RLS, functions and grants before applying to a disposable test environment.
- Keep the support-only branch out of full-app Preview; its current 5 tables cannot support complete MYRYRA flows. Avoid additional rebases/resets until the missing baseline is recovered and reviewed.

## Production privilege drift — read-only audit, 2026-11-21

- Production `public.support_tickets` currently grants `INSERT` to `authenticated` and has policy `Users create own support tickets` (`auth.uid() = user_id AND status = 'open'`). This is owner-scoped but permits direct authenticated inserts outside `/api/support/submit`, potentially bypassing API validation and the atomic per-user rate limit.
- The isolated support branch correctly has no authenticated `INSERT` grant, and its ticket creation is service-role-only through the `SECURITY INVOKER` RPC.
- The existing versioned migration `20261121050000_support_server_only_ticket_creation.sql` already revokes authenticated `INSERT/UPDATE/DELETE` and drops the legacy insert policy; `20261121060000_support_atomic_ticket_rate_limit.sql` additionally restricts ticket grants and RPC execution. Do not duplicate or prematurely deploy these migrations.
- Release gate: after an approved, controlled production migration, verify `has_table_privilege('authenticated','public.support_tickets','INSERT') = false`, that the legacy INSERT policy is absent, that owner-scoped reads still work, and that authorized server-side creation and rate limits pass. This check is pending, not yet passed.
- Production internal support tables `support_email_outbox`, `support_ticket_replies`, `support_admins` expose no direct `anon` or `authenticated` table privileges in this audit. Finance, Journey, and teacher sessions have RLS and role grants, but ownership policy effectiveness still needs authenticated multi-user E2E tests.

## Email outbox schema drift — verified read-only

- `public.support_email_outbox.processing_started_at` exists in the isolated support homologation database but **does not exist in production**. The worker uses this lease timestamp to atomically claim, recover and complete queued notifications.
- Production must not enable `MIKA_EMAIL_ENABLED` or the support outbox cron until the reviewed `20261121040000_support_outbox_recovery.sql` migration and subsequent security migrations are applied through the controlled release process, with column presence verified.
- This is distinct from the missing full-app schema baseline in the isolated branch. Fix both before calling MVP2 integrated validation complete.

## Support RPC availability drift — read-only verification

- The isolated homologation database has `public.create_support_ticket_limited(uuid,text,text,text,boolean)` as `SECURITY INVOKER`, with EXECUTE granted to `service_role` and `postgres` only.
- Production **does not yet have** this function. The new `/api/support/submit` endpoint calls it directly, so deploying the endpoint without the corresponding versioned migration would fail ticket creation.
- `public.admin_update_support_ticket(uuid,uuid,text,text)` exists in both databases as `SECURITY INVOKER`, with execution restricted to `service_role` and `postgres`.
- Release gate: migrate and verify the RPC exists and has the expected grants, ensure authenticated direct INSERT is revoked, ensure `processing_started_at` exists, and execute authenticated E2E creation/rate-limit tests before enabling customer support and email cron in production.

## Full application baseline inventory — read-only production metadata

The six required application tables absent from the isolated support branch have these production column counts (metadata only, no customer data): `events` 12, `tasks` 13, `plans` 5, `myryra_finance_entries` 6, `myryra_journeys` 10, `mika_teacher_sessions` 9. Total: 55 columns. All six tables have RLS enabled in production.

This inventory is **not** a reconstructible database schema: it does not include types, constraints, defaults, foreign keys, indexes, policies, grants, triggers, functions, or migration history. Do not replace the missing baseline with placeholder tables; obtain a reviewed schema-only baseline and reconcile migration order before retrying isolated branch rebase.

## Baseline dependency graph — production catalog, read-only

The six missing core tables participate in **19 foreign keys** (inbound and outbound), so recreating them in isolation cannot faithfully reproduce the app schema:

- `events`: depends on `auth.users`; referenced by `event_concierge`, `event_reminders`, `favorites`.
- `plans`: depends on `auth.users`; referenced by `tasks`.
- `tasks`: depends on `auth.users` and `plans`; referenced by `favorites`, `myka_task_confirmations`, `myryra_journey_task_links`.
- `myryra_finance_entries`: depends on `auth.users`.
- `myryra_journeys`: depends on `auth.users`; referenced by `mika_teacher_sessions`, `myryra_journey_achievements`, `myryra_journey_missions`, `myryra_journey_myra_ledger`, `myryra_journey_snapshot_confirmations`.
- `mika_teacher_sessions`: depends on `auth.users` and `myryra_journeys`; referenced by `mika_teacher_messages` using composite `(session_id, owner_id)` FK.

Preserve the original composite FK and cascade/set-null actions during schema-only baseline reconstruction. Validate all constraints, RLS policies and migration provenance before a branch rebase; do not synthesize placeholder tables.

## Missing baseline column catalog — read-only production inspection

Catalog inspection confirmed the six missing application tables comprise 55 columns and their original data types, nullability and defaults:

- `events` (12): `id uuid`, `user_id uuid`, `title text`, `starts_at timestamptz`, `ends_at timestamptz`, `location text?`, `notes text?`, `created_at timestamptz default now()`, `event_type text default 'appointment'`, `blocks_time boolean default false`, `deleted_at timestamptz?`, `category text default 'personal'`.
- `plans` (5): `id uuid`, `user_id uuid`, `title text`, `source_text text?`, `created_at timestamptz default now()`.
- `tasks` (13): `id uuid`, `plan_id uuid`, `user_id uuid`, `title text`, `priority text default 'Normal'`, `due_date date?`, `completed boolean default false`, `created_at timestamptz default now()`, `status text default 'todo'`, `duration_minutes integer?`, `completed_at timestamptz?`, `deleted_at timestamptz?`, `category text default 'personal'`.
- `myryra_finance_entries` (6): `id uuid`, `user_id uuid`, `description text`, `amount_cents bigint`, `kind text`, `created_at timestamptz default now()`.
- `myryra_journeys` (10): `id uuid`, `owner_id uuid`, `title text`, `description text?`, `status text default 'active'`, `visibility text default 'private'`, `target_date date?`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`, `confirmation_key uuid?`.
- `mika_teacher_sessions` (9): `id uuid`, `owner_id uuid`, `journey_id uuid`, `topic text`, `level text default 'iniciante'`, `scheduled_at timestamptz?`, `status text default 'active'`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.

All six `id` columns default to `gen_random_uuid()`. All columns without `?` are NOT NULL. This is a diagnostic inventory, **not** a deployable baseline: constraints, indexes, triggers, grants, RLS policies, dependent functions and migration provenance still require a verified schema-only export.

## Baseline constraints — read-only production catalog

The six missing core tables have **30 local constraints** (including primary keys, foreign keys, uniqueness and checks), verified against the production PostgreSQL catalog without reading customer records.

- `events`: 5 constraints; event category one of `work/family/leisure/health/personal/study`, title 1–200 characters, `ends_at > starts_at`, user FK, PK.
- `tasks`: 6 constraints; same categories, duration null or 5–1440 minutes, status one of `todo/in_progress/waiting/done`, user and plan FKs, PK.
- `plans`: 2 constraints; user FK and PK.
- `myryra_finance_entries`: 5 constraints; amount 1–100000000000 cents, trimmed description 1–100 characters, kind `income/expense`, user FK and PK.
- `myryra_journeys`: 5 constraints; status `active/paused/completed/archived`, title 1–120 trimmed characters, visibility `private/shared`, owner FK and PK.
- `mika_teacher_sessions`: 7 constraints; unique `(id,owner_id)` for downstream composite FK, topic 1–120 characters, level 1–40 characters, status `active/completed/cancelled`, owner and journey FKs, PK.

This catalog inspection does not authorize deployment of a reconstructed schema. Indexes, triggers, policies, grants, functions, migration provenance and cross-table dependencies remain mandatory for a faithful schema-only baseline.

## Baseline index inventory — read-only production catalog

The six missing tables have **16 indexes** in production:

- `events` (5): `events_pkey`, `events_user_start_idx`, `events_user_deleted_at_idx`, partial `events_user_category_idx` (`deleted_at IS NULL`), partial unique `events_autopilot_task_once_per_user_idx` on `(user_id, notes)` where notes starts with `Tarefa MYRYRA: `.
- `tasks` (2): `tasks_pkey`, `tasks_user_deleted_at_idx`.
- `plans` (1): `plans_pkey`.
- `myryra_finance_entries` (2): `myryra_finance_entries_pkey`, `myryra_finance_entries_user_created_idx`.
- `myryra_journeys` (3): `myryra_journeys_pkey`, `myryra_journeys_owner_idx`, partial unique `myryra_journeys_owner_confirmation_key_uq` (`confirmation_key IS NOT NULL`).
- `mika_teacher_sessions` (3): `mika_teacher_sessions_pkey`, unique `mika_teacher_sessions_id_owner_id_key`, `mika_teacher_sessions_owner_created_idx`.

The `events_autopilot_task_once_per_user_idx` is the exact index whose migration failed in isolated homologation because `public.events` did not exist. Preserve migration ordering and the original partial predicates. This inventory is diagnostic, not an authorization to alter production or fabricate the missing schema.

## Core RLS policy audit — production metadata, read-only

The six missing baseline tables contain **24 policies**: `events` 5, `tasks` 4, `plans` 4, `myryra_finance_entries` 3, `myryra_journeys` 4, and `mika_teacher_sessions` 4. All policies target `authenticated` and use ownership predicates; `tasks` additionally verifies the parent plan belongs to the caller, and teacher-session INSERT checks that the journey belongs to the caller and is active.

**Security/behavior review finding:** `events` has two permissive UPDATE policies. `Users can update own events` checks only `auth.uid() = user_id`, while `events_owner_update_category` additionally requires `deleted_at IS NULL`. PostgreSQL combines permissive policies with OR, so the latter restriction does **not** prevent updates of soft-deleted events when the former allows them. Determine intended soft-delete and restore behavior before proposing a policy change; preserve legitimate restore functionality. No production RLS changes were applied.

The policies inventory is insufficient to declare tenant isolation tested: execute authenticated two-user E2E probes against an isolated complete baseline before release.
