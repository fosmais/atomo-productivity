create table if not exists public.myryra_health_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 goal text not null check (goal in ('lose','maintain','gain','fitness')),
 activities text[] not null default '{}',
 days_per_week integer not null check (days_per_week between 1 and 7),
 minutes_per_session integer not null check (minutes_per_session between 10 and 180),
 limitations text not null default '' check (char_length(limitations) <= 500),
 updated_at timestamptz not null default now()
);
alter table public.myryra_health_profiles enable row level security;
revoke all on public.myryra_health_profiles from anon;
grant select,insert,update,delete on public.myryra_health_profiles to authenticated;
create policy "health_profile_select_own" on public.myryra_health_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "health_profile_insert_own" on public.myryra_health_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "health_profile_update_own" on public.myryra_health_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "health_profile_delete_own" on public.myryra_health_profiles for delete to authenticated using ((select auth.uid()) = user_id);