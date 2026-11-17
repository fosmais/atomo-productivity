-- Candidate secondary indexes for a fresh isolated MYRYRA core schema only.
-- Reconstructed from PROD pg_indexes on 2026-11-17.
-- Primary-key indexes are intentionally omitted: they must be created by
-- the corresponding PRIMARY KEY constraints in the foundational table DDL.
begin;
do $preflight$
declare t text;
begin
  foreach t in array array['events','favorites','myka_conversations','myka_messages','tasks'] loop
    if to_regclass('public.'||t) is null then
      raise exception 'Required core table public.% is missing',t;
    end if;
  end loop;
end $preflight$;

create unique index if not exists events_autopilot_task_once_per_user_idx
  on public.events using btree (user_id, notes)
  where notes ~~ 'Tarefa MYRYRA: %';
create index if not exists events_user_category_idx
  on public.events using btree (user_id, category, starts_at)
  where deleted_at is null;
create index if not exists events_user_deleted_at_idx
  on public.events using btree (user_id, deleted_at);
create index if not exists events_user_start_idx
  on public.events using btree (user_id, starts_at);

create index if not exists favorites_user_created_idx
  on public.favorites using btree (user_id, created_at desc);
create unique index if not exists favorites_user_event_unique
  on public.favorites using btree (user_id, event_id)
  where event_id is not null;
create unique index if not exists favorites_user_task_unique
  on public.favorites using btree (user_id, task_id)
  where task_id is not null;

create unique index if not exists myka_conversations_id_user_unique
  on public.myka_conversations using btree (id, user_id);
create index if not exists myka_conversations_user_updated_idx
  on public.myka_conversations using btree (user_id, updated_at desc);

create index if not exists myka_messages_conversation_created_idx
  on public.myka_messages using btree (conversation_id, created_at, id);

create index if not exists tasks_user_deleted_at_idx
  on public.tasks using btree (user_id, deleted_at);
commit;
