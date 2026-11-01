-- Development-only proposal; not applied automatically.
create table if not exists public.focus_sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 duration_minutes integer not null check (duration_minutes in (15,25,45,60)),
 completed_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create index if not exists focus_sessions_user_completed_idx on public.focus_sessions(user_id,completed_at desc);
alter table public.focus_sessions enable row level security;
revoke all on public.focus_sessions from anon;
grant select,insert on public.focus_sessions to authenticated;
create policy "focus_sessions_own_select" on public.focus_sessions for select to authenticated using ((select auth.uid())=user_id);
create policy "focus_sessions_own_insert" on public.focus_sessions for insert to authenticated with check ((select auth.uid())=user_id);
-- The client records only completed sessions; no task title is stored.
