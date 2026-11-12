# MYRYRA Journey — homologation branch recovery

## Observed 2026-11-12
- Main Supabase project: `qothgddrvrpeqsprslqk` (healthy; DO NOT apply unvalidated changes).
- A new isolated branch `myryra-mvp2-journey-homolog` failed with `MIGRATIONS_FAILED` and contained none of `public.events`, `public.myryra_journeys`, or `public.myryra_journey_missions`.
- Branch was deleted to stop hourly compute charges.
- Earlier homologation branches also show `MIGRATIONS_FAILED` and lack Journey tables.
- Main database migration history includes `20261109212001_create_atomic_journey_with_missions` and subsequent Journey migrations. This does **not** establish that the GitHub migration directory can be replayed from a clean database.

## Safe recovery procedure
1. Compare the ordered repository migration filenames and contents against the main database migration history; identify missing or duplicate versions and schema dependencies.
2. Obtain the *first failing migration* and exact PostgreSQL error from Supabase branch provisioning logs or CLI migration replay. Do not infer root cause from `MIGRATIONS_FAILED` alone.
3. Reproduce in a disposable local Supabase/Postgres environment before creating another hourly-billed branch.
4. Repair migration order/idempotency in a separate PR. Never rewrite already-applied production migration history or drop live data.
5. Run a clean migration replay and verify RLS, grants and table dependencies for `events`, `myryra_journeys` and `myryra_journey_missions`.
6. Only after clean replay, create a new isolated branch with approved cost, apply `20261112000100_myryra_journey_lesson_atomic.sql`, and exercise owner, duplicate, conflict, concurrency and timeout cases using test users.
7. Keep production unchanged until the integration tests and rollout checklist pass.

## Booking concurrency limitation
The RPC uses an advisory lock per user and a SHARE ROW EXCLUSIVE lock on `events` to wait for existing direct writes. A subsequent direct Agenda write can still overlap a booked lesson. A universal no-overlap policy requires a separate product/schema decision because existing events may legitimately overlap. Do not introduce a global exclusion constraint without checking existing data and UX requirements.

## Verified migration-history drift (2026-11-12)
Read-only queries against the production `supabase_migrations.schema_migrations` table confirm that the following Journey migrations were applied, but matching migration files were **not found at their exact names** in the inspected GitHub branches:
- `20261109212001_create_atomic_journey_with_missions`
- `20261110004235_journey_confirmation_idempotency_key`
- `20261110011758_myryra_atomic_journey_confirmation`
- `20261110033112_create_owner_scoped_journey_draft_snapshots`
- `20261110033908_add_signed_journey_snapshot_integrity`
- `20261110034947_atomic_journey_snapshot_confirmation_link`
- `20261110121233_myryra_journey_myra_rewards_ledger`
- `20261110192741_journey_achievements_private_photos_20261110`
- `20261110200551_journey_learning_progress_private`
- `20261110225657_journey_learning_assessment_metadata`
- `20261110232856_journey_review_steps_persistence`
- `20261111005128_journey_achievement_snapshots`

These records are **not sufficient** to reconstruct the migration SQL. Do not generate speculative DDL or change production migration history. Recover original migration source from the deployment pipeline/SQL backups or produce a separately reviewed baseline using verified catalog definitions and grants. The exact branch-provisioning error is still unknown.

## Verified security audit 2026-11-12
Production catalog inspection found all three base tables with RLS enabled: `events` (12 columns), `myryra_journeys` (10), and `myryra_journey_missions` (7). Thirteen policies were found; all owner-scoped via `auth.uid()`, with mission ownership checked through the parent journey. The additional `events_owner_update_category` UPDATE policy is permissive and does **not** override the broader existing owner UPDATE policy; do not mistake it for an exclusive restriction on soft-deleted rows. The two existing Journey creation RPCs are SECURITY INVOKER. `myryra_book_journey_lesson` does not yet exist in production. All checks were read-only.

The 12 original Journey SQL statements were recovered from the `statements` column of `supabase_migrations.schema_migrations` and checked into the feature branch. This restores historical SQL but does not prove clean replay; older base-table creation migrations and branch-provisioning failure still require investigation.

## Confirmed bootstrap gap 2026-11-12
The earliest recorded production migration is `20261030174834_autopilot_transactional_reservation`. It creates an RPC against existing application tables. Subsequent early migrations reference `public.events`, `public.tasks`, `public.plans` and `public.favorites`. None of the first entries constitutes an initial schema bootstrap. Thus **production migration history alone cannot create a clean database**. This is a verified prerequisite gap, not yet the exact Supabase branch failure log.

Recovery must first locate the original bootstrap schema (initial SQL scripts, prior deployment snapshots, or a reviewed `pg_dump --schema-only` of the live database with secrets excluded). Do not replay a production schema dump blindly: it may include auth-managed objects, environment-specific roles and grants, and already-applied migrations. Prefer a versioned baseline limited to application-owned schema, then validate full replay in a disposable local instance before opening a new paid branch.

## Baseline dependency inventory 2026-11-12
Read-only production catalog inspection confirmed **13 indexes** across `plans`, `tasks`, `events`, `myryra_journeys` and `myryra_journey_missions` (five primary-key indexes and eight secondary indexes). The `events_autopilot_task_once_per_user_idx` is a partial unique index on `(user_id,notes)` for notes matching `Tarefa MYRYRA: %`; preserve this constraint in any faithful bootstrap. The `myryra_journeys_owner_confirmation_key_uq` is a partial unique index for non-null confirmation keys. One non-internal trigger was identified: `myryra_mission_credit_myra`, AFTER INSERT OR UPDATE OF status on missions, invoking `myryra_credit_completed_mission()`. This function and its ledger dependencies must be recreated **after** base tables and before attaching the trigger. Four owner-scoped `plans` RLS policies were confirmed. These are catalog observations, not successful replay results.

Do not treat the five-table candidate as a complete baseline. Remaining work: reconcile all application-owned tables referenced by 42 production migrations, full policy expressions, grants, triggers, function dependencies and ordering. Only then attempt disposable local replay and integration tests.

## Full public schema inventory 2026-11-12
Production has **60 ordinary tables in `public`**, of which **25** start with `myryra_`. These include billing, support, Google Calendar, MIKA, privacy, health, finance, and Journey. The five-table candidate covers only a small part of the production schema. The complete 42-migration history was recovered from `supabase_migrations.schema_migrations.statements`, but this history starts after application tables already existed. Do **not** claim that restoring all 42 migration files makes clean replay possible. The original bootstrap must account for all required pre-existing tables, policies, roles, functions, triggers and indexes.

Prioritize a scoped Journey/Agenda test fixture over recreating all 60 production tables for the first local integration test, while retaining a separate full-schema parity task for eventual branch provisioning. Never copy production user rows or billing secrets to a fixture.

## Release gate — MIKA lesson scheduling (2026-11-12)

Automated CI passing is **not** authenticated end-to-end validation. The candidate UI in `src/app/dashboard/mika-journey-planner.tsx` calls `public.myryra_book_journey_lesson` after an explicit confirmation, and the MIKA lesson endpoint requires a signed-in owner and an active journey/pending mission. The booking currently lasts **20 minutes** and does not synchronize to Google Calendar. Do not claim arbitrary lesson durations or natural-language chat scheduling.

**Preflight (read-only):** verify the target environment's deployed commit, Supabase project ID, migration presence, RPC signature/grants, `events` trigger, Journey/mission RLS, and isolated test accounts. A SQL migration file or a successful CI fixture does not prove that the RPC exists in the target database. Never apply a production migration merely to make a test pass.

**Authenticated staging test (only after clean isolated database setup):**
1. Create two synthetic users A and B via normal Auth. Under A, create an active test journey with a pending test mission; under B, create an independent journey.
2. With A, open Journey and select **Agendar aula na Agenda**; enter a future local date/time and verify the confirmation dialog displays the mission title, local date/time and 20-minute duration. Cancel once and verify no event was inserted.
3. Confirm the booking once; require a returned UUID and exactly one owner-scoped `events` row with the expected Journey/mission marker, 20-minute interval and `blocks_time=true`. Refresh Agenda and confirm the event remains visible.
4. Repeat the booking for the same mission; expect a duplicate rejection and no second event. Attempt a conflicting booking; expect conflict rejection. Verify an adjacent non-overlapping interval is allowed for a different mission.
5. Attempt A's mission booking while authenticated as B and unauthenticated; both must fail without writing an event. Exercise two simultaneous booking requests for the same mission; expect at most one inserted event.
6. From the Agenda event, open its linked Journey/mission and start the MIKA session. Send a learner reply and verify contextual feedback without claiming completion or awarding MYRA merely for chatting.
7. Verify failure handling for unavailable OpenAI, missing RPC, session expiry and permission errors; show actionable messages without leaking secrets or creating phantom appointments.
8. Record evidence (test timestamp, sanitized event ID, commit SHA, environment, screenshots and database row counts). Delete only the synthetic fixtures after approval.

**Release decision:** require clean CI, all staging tests above, review of the 325+ commit delta, migration parity, LGPD document publication/acceptance decision, and rollback plan. No automatic production promotion; preserve payments disabled. Keep build count low due to Vercel costs.

## Live database recheck — 2026-11-12 (read-only)

A fresh read-only catalog query of the main Supabase project confirms `public.myryra_book_journey_lesson(p_journey_id uuid, p_mission_id uuid, p_starts_at timestamptz)` **does exist**, is `SECURITY INVOKER`, and `authenticated` has `EXECUTE` permission. The `public.events` trigger `myryra_guard_blocking_event_overlap` also exists and is enabled (`tgenabled='O'`). This supersedes the earlier statement that the RPC was missing in production. **No migration was applied and no user event was created in this check.** This establishes database availability only, not a working end-to-end booking from the production UI or a passing authenticated staging test. Retain the isolated staging release gate and do not treat these catalog results as user acceptance.
