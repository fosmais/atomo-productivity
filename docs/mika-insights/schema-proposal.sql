-- MIKA Insights: apply only after reviewing on a Supabase preview branch.
create table if not exists public.mika_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 10000),
  title text check (title is null or char_length(title) <= 160),
  source text not null default 'text' check (source in ('text', 'voice')),
  status text not null default 'captured' check (status in ('captured', 'analyzing', 'planned', 'archived')),
  proposed_plan jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mika_ideas_user_created_idx on public.mika_ideas (user_id, created_at desc);
alter table public.mika_ideas enable row level security;
revoke all on public.mika_ideas from anon;
grant select, insert, update, delete on public.mika_ideas to authenticated;
create policy "mika_ideas_select_own" on public.mika_ideas for select to authenticated using ((select auth.uid()) = user_id);
create policy "mika_ideas_insert_own" on public.mika_ideas for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "mika_ideas_update_own" on public.mika_ideas for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "mika_ideas_delete_own" on public.mika_ideas for delete to authenticated using ((select auth.uid()) = user_id);
-- Set updated_at from the application until a shared trigger strategy is reviewed.
