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
