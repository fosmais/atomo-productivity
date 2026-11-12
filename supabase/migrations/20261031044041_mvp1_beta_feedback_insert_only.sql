create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('ideia','problema','avaliacao')),
  message text not null check (char_length(message) between 10 and 1500),
  created_at timestamptz not null default now()
);
alter table public.beta_feedback enable row level security;
revoke all on public.beta_feedback from anon, authenticated;
grant insert on public.beta_feedback to authenticated;
drop policy if exists beta_feedback_submit_own on public.beta_feedback;
create policy beta_feedback_submit_own on public.beta_feedback for insert to authenticated
with check ((select auth.uid()) = user_id);
create index if not exists beta_feedback_user_created_idx on public.beta_feedback (user_id, created_at desc);