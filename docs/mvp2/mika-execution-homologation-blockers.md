# MIKA internal task execution — homologation gate

## Evidence (2026-11-11)
Read-only SQL against the active Supabase project `qothgddrvrpeqsprslqk`:
```sql
select
 to_regclass('public.mika_action_proposals') as proposals,
 to_regclass('public.mika_action_audit') as audit,
 to_regprocedure('public.mika_execute_approved_task(uuid,uuid)') as executor;
```
All three returned `null`. **No execution can succeed against this database.**

## Release blockers
1. Reconcile migration history and inspect the proposed schemas, RLS, function privileges and existing `plans`/`tasks` compatibility in an isolated homologation environment.
2. Apply approved migrations **only to homologation**. Do not apply the incompatible `docs/sql/mika-agent-staging-proposals.sql` migration blindly.
3. Create a test user, published/effective legal documents, an explicit acceptance, a user-owned plan and an approved `create_task` proposal. Do not fabricate acceptances for real users.
4. Exercise the RPC as an authenticated user: first call returns `executed` and a task ID; retry returns `already_executed` with the same ID; concurrent requests create exactly one task.
5. Verify `mika_action_audit` contains exactly one `succeeded` event; expired, rejected, cross-user and plan-mismatch requests must not create tasks.
6. Confirm `anon`, `PUBLIC`, and `service_role` have no EXECUTE grant and RLS restricts proposal/audit visibility.
7. Run CI, inspect DB advisors, and explicitly approve a separate production release. The HTTP endpoint currently hard-blocks `VERCEL_ENV=production`.

## Current application state
`POST /api/mika/execute-approved-task` is implemented but opt-in and production-blocked. The Concierge `mika_agent_actions` authorization flow is **not** connected to `mika_action_proposals` and does not execute external provider operations. Do not describe the integration as operational until both proposal creation/approval and transactional execution are connected and verified.
