create table if not exists public.myryra_finance_alert_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 days integer not null default 7 check (days in (3,7,14)),
 subscriptions boolean not null default true,
 expenses boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.myryra_finance_alert_preferences enable row level security;
drop policy if exists "finance_alert_prefs_select_own" on public.myryra_finance_alert_preferences;
create policy "finance_alert_prefs_select_own" on public.myryra_finance_alert_preferences for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "finance_alert_prefs_insert_own" on public.myryra_finance_alert_preferences;
create policy "finance_alert_prefs_insert_own" on public.myryra_finance_alert_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "finance_alert_prefs_update_own" on public.myryra_finance_alert_preferences;
create policy "finance_alert_prefs_update_own" on public.myryra_finance_alert_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.myryra_finance_alert_preferences to authenticated;