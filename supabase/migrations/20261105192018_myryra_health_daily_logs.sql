create table public.myryra_health_logs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check (category in ('weight','workout','meal','sleep','meditation')),
 occurred_on date not null default current_date,
 value numeric(10,2),
 unit text,
 notes text not null default '' check (char_length(notes)<=500),
 created_at timestamptz not null default now(),
 constraint health_log_value check (value is null or (value >= 0 and value <= 100000)),
 constraint health_log_unit check (unit is null or unit in ('kg','minutes','hours','count'))
);
create index myryra_health_logs_user_date on public.myryra_health_logs(user_id,occurred_on desc);
alter table public.myryra_health_logs enable row level security;
revoke all on public.myryra_health_logs from anon;
grant select,insert,update,delete on public.myryra_health_logs to authenticated;
create policy "health_logs_select_own" on public.myryra_health_logs for select to authenticated using ((select auth.uid())=user_id);
create policy "health_logs_insert_own" on public.myryra_health_logs for insert to authenticated with check ((select auth.uid())=user_id);
create policy "health_logs_update_own" on public.myryra_health_logs for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "health_logs_delete_own" on public.myryra_health_logs for delete to authenticated using ((select auth.uid())=user_id);