-- Candidate foundational DDL reconstructed from PROD information_schema on 2026-11-17.
-- Fresh disposable DB only. Run BEFORE core constraints, indexes, RLS.
-- Requires auth.users provided by Supabase (or disposable fixture).
begin;
do $preflight$
begin
 if to_regclass('auth.users') is null then raise exception 'Missing auth.users'; end if;
 if exists(select 1 from (values ('plans'),('tasks'),('events'),('favorites'),('myka_conversations'),('myka_messages'),('google_calendar_connections')) as t(name)
           where to_regclass('public.'||t.name) is not null) then
   raise exception 'Core baseline requires a fresh schema; existing core table detected';
 end if;
end $preflight$;
create table public.plans (
 id uuid primary key default gen_random_uuid(), user_id uuid not null, title text not null,
 source_text text, created_at timestamptz not null default now()
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), plan_id uuid not null, user_id uuid not null,
 title text not null, priority text not null default 'Normal', due_date date,
 completed boolean not null default false, created_at timestamptz not null default now(),
 status text not null default 'todo', duration_minutes integer, completed_at timestamptz,
 deleted_at timestamptz, category text not null default 'personal'
);
create table public.events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null, title text not null,
 starts_at timestamptz not null, ends_at timestamptz not null, location text, notes text,
 created_at timestamptz not null default now(), event_type text not null default 'appointment',
 blocks_time boolean not null default false, deleted_at timestamptz,
 category text not null default 'personal'
);
create table public.favorites (
 id uuid primary key default gen_random_uuid(), user_id uuid not null,
 task_id uuid, event_id uuid, created_at timestamptz not null default now()
);
create table public.google_calendar_connections (
 user_id uuid primary key, google_account_id text, encrypted_access_token text not null,
 encrypted_refresh_token text, token_expires_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.myka_conversations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null,
 title text not null default 'Nova conversa',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.myka_messages (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null,
 user_id uuid not null, role text not null, content text not null,
 proposed_task jsonb, proposed_event jsonb, created_at timestamptz not null default now(),
 task_status text not null default 'legacy', event_status text not null default 'legacy'
);
commit;
