create table if not exists public.myryra_finance_goals (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 100),
 target_cents bigint not null check (target_cents between 1 and 100000000000),
 saved_cents bigint not null default 0 check (saved_cents between 0 and 100000000000),
 created_at timestamptz not null default now()
);
create table if not exists public.myryra_finance_planned_expenses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 100),
 amount_cents bigint not null check (amount_cents between 1 and 100000000000),
 due_date date not null,
 created_at timestamptz not null default now()
);
create index if not exists myryra_finance_goals_user_idx on public.myryra_finance_goals(user_id,created_at desc);
create index if not exists myryra_finance_planned_user_idx on public.myryra_finance_planned_expenses(user_id,due_date);
alter table public.myryra_finance_goals enable row level security;
alter table public.myryra_finance_planned_expenses enable row level security;
revoke all on public.myryra_finance_goals from anon;
revoke all on public.myryra_finance_planned_expenses from anon;
grant select,insert,delete on public.myryra_finance_goals to authenticated;
grant select,insert,delete on public.myryra_finance_planned_expenses to authenticated;
create policy "finance_goals_select" on public.myryra_finance_goals for select to authenticated using ((select auth.uid())=user_id);
create policy "finance_goals_insert" on public.myryra_finance_goals for insert to authenticated with check ((select auth.uid())=user_id);
create policy "finance_goals_delete" on public.myryra_finance_goals for delete to authenticated using ((select auth.uid())=user_id);
create policy "finance_planned_select" on public.myryra_finance_planned_expenses for select to authenticated using ((select auth.uid())=user_id);
create policy "finance_planned_insert" on public.myryra_finance_planned_expenses for insert to authenticated with check ((select auth.uid())=user_id);
create policy "finance_planned_delete" on public.myryra_finance_planned_expenses for delete to authenticated using ((select auth.uid())=user_id);