create table if not exists public.myryra_finance_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 alert_key text not null,
 title text not null,
 body text not null,
 due_date date,
 read_at timestamptz,
 created_at timestamptz not null default now(),
 unique(user_id,alert_key),
 constraint notification_title_limit check (char_length(title) between 1 and 180),
 constraint notification_body_limit check (char_length(body) between 1 and 1000)
);
create index if not exists myryra_finance_notifications_user_created on public.myryra_finance_notifications(user_id,created_at desc);
alter table public.myryra_finance_notifications enable row level security;
create policy "finance_notifications_read_own" on public.myryra_finance_notifications for select to authenticated using ((select auth.uid())=user_id);
create policy "finance_notifications_insert_own" on public.myryra_finance_notifications for insert to authenticated with check ((select auth.uid())=user_id);
create policy "finance_notifications_update_own" on public.myryra_finance_notifications for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update on public.myryra_finance_notifications to authenticated;