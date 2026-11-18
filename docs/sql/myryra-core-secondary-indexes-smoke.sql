-- Disposable PostgreSQL only. Minimal table fixtures for secondary index DDL.
create table public.events(
 id uuid primary key default gen_random_uuid(), user_id uuid not null,
 notes text, category text, starts_at timestamptz, deleted_at timestamptz
);
create table public.favorites(
 id uuid primary key default gen_random_uuid(), user_id uuid not null,
 task_id uuid, event_id uuid, created_at timestamptz default now()
);
create table public.myka_conversations(
 id uuid primary key default gen_random_uuid(), user_id uuid not null,
 updated_at timestamptz default now()
);
create table public.myka_messages(
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null,
 created_at timestamptz default now()
);
create table public.tasks(
 id uuid primary key default gen_random_uuid(), user_id uuid not null, deleted_at timestamptz
);
\i docs/sql/myryra-core-secondary-indexes-candidate.sql

do $test$
declare n int;
begin
 select count(*) into n from pg_indexes where schemaname='public' and indexname in (
 'events_autopilot_task_once_per_user_idx','events_user_category_idx',
 'events_user_deleted_at_idx','events_user_start_idx','favorites_user_created_idx',
 'favorites_user_event_unique','favorites_user_task_unique','myka_conversations_id_user_unique',
 'myka_conversations_user_updated_idx','myka_messages_conversation_created_idx',
 'tasks_user_deleted_at_idx');
 if n <> 11 then raise exception 'Expected 11 secondary indexes, found %',n; end if;
end $test$;

insert into public.favorites(user_id,event_id)
values ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
do $test$
begin
 begin
  insert into public.favorites(user_id,event_id)
  values ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  raise exception 'Duplicate favorite event unexpectedly accepted';
 exception when unique_violation then null;
 end;
end $test$;
