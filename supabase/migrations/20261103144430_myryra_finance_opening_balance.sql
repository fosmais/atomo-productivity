create table if not exists public.myryra_finance_balances (
 user_id uuid primary key references auth.users(id) on delete cascade,
 opening_balance_cents bigint not null default 0 check (opening_balance_cents between -100000000000 and 100000000000),
 updated_at timestamptz not null default now()
);
alter table public.myryra_finance_balances enable row level security;
revoke all on public.myryra_finance_balances from anon;
grant select, insert, update on public.myryra_finance_balances to authenticated;
create policy "finance_balance_select_own" on public.myryra_finance_balances for select to authenticated using ((select auth.uid()) = user_id);
create policy "finance_balance_insert_own" on public.myryra_finance_balances for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "finance_balance_update_own" on public.myryra_finance_balances for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);