-- MYRYRA MVP1 — proposed foreign-key indexes (REVIEW ONLY).
-- NOT a Supabase migration. Do not run automatically or in production without approval.
-- Existing indexes checked against Supabase on 2026-10-31.
-- Each statement is idempotent; execute in a controlled maintenance window.
-- PostgreSQL CREATE INDEX CONCURRENTLY must run outside a transaction block.
-- Validate index usage and write impact after rollout.

create index concurrently if not exists favorites_event_id_fk_idx
  on public.favorites (event_id);
create index concurrently if not exists favorites_task_id_fk_idx
  on public.favorites (task_id);
create index concurrently if not exists myka_messages_conversation_user_fk_idx
  on public.myka_messages (conversation_id, user_id);
create index concurrently if not exists myka_messages_user_id_fk_idx
  on public.myka_messages (user_id);
create index concurrently if not exists myka_task_confirmations_task_id_fk_idx
  on public.myka_task_confirmations (task_id);
create index concurrently if not exists plans_user_id_fk_idx
  on public.plans (user_id);
create index concurrently if not exists tasks_plan_id_fk_idx
  on public.tasks (plan_id);
create index concurrently if not exists tasks_user_id_fk_idx
  on public.tasks (user_id);

-- Read-only post-change verification:
-- select tablename, indexname, indexdef from pg_indexes
-- where schemaname = 'public' and indexname like '%_fk_idx'
-- order by tablename, indexname;
