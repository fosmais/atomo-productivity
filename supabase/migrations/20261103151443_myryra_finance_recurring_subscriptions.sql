create table if not exists public.myryra_finance_subscriptions (
id uuid primary key default gen_random_uuid(),
user_id uuid not null references auth.users(id) on delete cascade,
title text not null check (char_length(btrim(title)) between 1 and 100),
amount_cents bigint not null check (amount_cents between 1 and 100000000000),
billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly','yearly')),
next_due_date date not null,
created_at timestamptz not null default now()
);
create index if not exists myryra_finance_subscriptions_user_due_idx on public.myryra_finance_subscriptions(user_id,next_due_date);
alter table public.myryra_finance_subscriptions enable row level security;
revoke all on public.myryra_finance_subscriptions from anon;
grant select,insert,delete on public.myryra_finance_subscriptions to authenticated;
create policy "finance_subscriptions_select" on public.myryra_finance_subscriptions for select to authenticated using ((select auth.uid())=user_id);
create policy "finance_subscriptions_insert" on public.myryra_finance_subscriptions for insert to authenticated with check ((select auth.uid())=user_id);
create policy "finance_subscriptions_delete" on public.myryra_finance_subscriptions for delete to authenticated using ((select auth.uid())=user_id);