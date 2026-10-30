-- MVP 1: favorites owned by the authenticated user.
-- Already applied to the MYRYRA Supabase project on 2026-10-30.
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_exactly_one_target check ((task_id is not null) <> (event_id is not null))
);

create unique index if not exists favorites_user_task_unique
  on public.favorites(user_id, task_id) where task_id is not null;
create unique index if not exists favorites_user_event_unique
  on public.favorites(user_id, event_id) where event_id is not null;
create index if not exists favorites_user_created_idx
  on public.favorites(user_id, created_at desc);

alter table public.favorites enable row level security;
revoke all on public.favorites from anon;
grant select, insert, delete on public.favorites to authenticated;

drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own on public.favorites
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own on public.favorites
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists favorites_insert_owned_target on public.favorites;
create policy favorites_insert_owned_target on public.favorites
  for insert to authenticated with check (
    (select auth.uid()) = user_id and (
      (task_id is not null and exists (
        select 1 from public.tasks t
        where t.id = task_id and t.user_id = (select auth.uid())
      )) or
      (event_id is not null and exists (
        select 1 from public.events e
        where e.id = event_id and e.user_id = (select auth.uid())
      ))
    )
  );
