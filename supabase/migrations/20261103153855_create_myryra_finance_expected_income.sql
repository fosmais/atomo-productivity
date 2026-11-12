create table if not exists public.myryra_finance_expected_income (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 100),
 amount_cents bigint not null check (amount_cents > 0),
 due_date date not null,
 created_at timestamptz not null default now()
);
create index if not exists myryra_finance_expected_income_user_date on public.myryra_finance_expected_income(user_id,due_date);
alter table public.myryra_finance_expected_income enable row level security;
create policy "Users read own expected income" on public.myryra_finance_expected_income for select to authenticated using ((select auth.uid())=user_id);
create policy "Users insert own expected income" on public.myryra_finance_expected_income for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Users delete own expected income" on public.myryra_finance_expected_income for delete to authenticated using ((select auth.uid())=user_id);
grant select,insert,delete on public.myryra_finance_expected_income to authenticated;