-- MYRYRA application bootstrap candidate, reconstructed from production catalog on 2026-11-12.
-- REVIEW ONLY. Not an applied migration. Do not deploy or replay without a
-- disposable local Supabase instance and reconciliation of all dependencies.
-- Requires Supabase-managed auth.users and gen_random_uuid().
-- Represents five base tables, not the complete production schema.
create table if not exists public.plans (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null,
 source_text text,
 created_at timestamptz not null default now()
);
create table if not exists public.tasks (
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references public.plans(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null,
 priority text not null default 'Normal',
 due_date date,
 completed boolean not null default false,
 created_at timestamptz not null default now(),
 status text not null default 'todo' check (status = any(array['todo','in_progress','waiting','done'])),
 duration_minutes integer check (duration_minutes is null or (duration_minutes >= 5 and duration_minutes <= 1440)),
 completed_at timestamptz,
 deleted_at timestamptz,
 category text not null default 'personal' check (category = any(array['work','family','leisure','health','personal','study']))
);
create table if not exists public.events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) >= 1 and char_length(title) <= 200),
 starts_at timestamptz not null,
 ends_at timestamptz not null check (ends_at > starts_at),
 location text,
 notes text,
 created_at timestamptz not null default now(),
 event_type text not null default 'appointment',
 blocks_time boolean not null default false,
 deleted_at timestamptz,
 category text not null default 'personal' check (category = any(array['work','family','leisure','health','personal','study']))
);
create table if not exists public.myryra_journeys (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 120),
 description text,
 status text not null default 'active' check (status = any(array['active','paused','completed','archived'])),
 visibility text not null default 'private' check (visibility = any(array['private','shared'])),
 target_date date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 confirmation_key uuid
);
create table if not exists public.myryra_journey_missions (
 id uuid primary key default gen_random_uuid(),
 journey_id uuid not null references public.myryra_journeys(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 160),
 status text not null default 'pending' check (status = any(array['pending','completed'])),
 due_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now()
);
-- Intentionally excludes policies, grants, indexes, triggers, functions and
-- other application tables. Apply no DDL until the full dependency graph is
-- audited and local replay is successful.
