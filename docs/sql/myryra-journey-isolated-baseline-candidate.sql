-- MYRYRA Journey: candidate baseline for a FRESH ISOLATED database only.
-- DO NOT apply to PROD or existing previews without a separate change review.
-- Derived from read-only PROD catalog inspection on 2026-11-17.
-- This is NOT a complete MYRYRA schema baseline.
begin;
do $preflight$
begin
  if to_regclass('public.myryra_journeys') is not null then
    raise exception 'Journey baseline expects an absent table; aborting to avoid changing existing schema';
  end if;
  if to_regclass('auth.users') is null then
    raise exception 'Supabase auth.users is required';
  end if;
end $preflight$;

create table public.myryra_journeys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text,
  status text not null default 'active'
    check (status in ('active','paused','completed','archived')),
  visibility text not null default 'private'
    check (visibility in ('private','shared')),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmation_key uuid
);
alter table public.myryra_journeys enable row level security;
revoke all on public.myryra_journeys from public, anon, authenticated;
grant select, insert, update, delete on public.myryra_journeys to authenticated;
create policy journeys_select_owner on public.myryra_journeys
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy journeys_insert_owner on public.myryra_journeys
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy journeys_update_owner on public.myryra_journeys
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy journeys_delete_owner on public.myryra_journeys
  for delete to authenticated using ((select auth.uid()) = owner_id);
commit;
