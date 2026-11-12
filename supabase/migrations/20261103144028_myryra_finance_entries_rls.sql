create table if not exists public.myryra_finance_entries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 description text not null check (char_length(btrim(description)) between 1 and 100),
 amount_cents bigint not null check (amount_cents between 1 and 100000000000),
 kind text not null check (kind in ('income','expense')),
 created_at timestamptz not null default now()
);
create index if not exists myryra_finance_entries_user_created_idx on public.myryra_finance_entries(user_id, created_at desc);
alter table public.myryra_finance_entries enable row level security;
revoke all on public.myryra_finance_entries from anon;
grant select, insert, delete on public.myryra_finance_entries to authenticated;
create policy "finance_select_own" on public.myryra_finance_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy "finance_insert_own" on public.myryra_finance_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "finance_delete_own" on public.myryra_finance_entries for delete to authenticated using ((select auth.uid()) = user_id);