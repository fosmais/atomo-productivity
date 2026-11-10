-- MIKA Journey: per-user, per-mission review checklist persistence.
-- Kept separate from learning answers to avoid overwriting tutor feedback.
create table if not exists public.myryra_journey_review_steps (
  mission_id uuid primary key references public.myryra_journey_missions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  steps jsonb not null default '[false,false,false]'::jsonb
    check (jsonb_typeof(steps) = 'array'
      and jsonb_array_length(steps) = 3
      and jsonb_typeof(steps->0) = 'boolean'
      and jsonb_typeof(steps->1) = 'boolean'
      and jsonb_typeof(steps->2) = 'boolean'),
  updated_at timestamptz not null default now()
);
create index if not exists myryra_journey_review_steps_owner_idx
  on public.myryra_journey_review_steps(owner_id);
alter table public.myryra_journey_review_steps enable row level security;
revoke all on public.myryra_journey_review_steps from anon;
grant select, insert, update on public.myryra_journey_review_steps to authenticated;
drop policy if exists journey_review_steps_owner_select on public.myryra_journey_review_steps;
create policy journey_review_steps_owner_select on public.myryra_journey_review_steps
for select to authenticated using (
  owner_id = (select auth.uid()) and exists (
    select 1 from public.myryra_journey_missions m
    join public.myryra_journeys j on j.id = m.journey_id
    where m.id = mission_id and j.owner_id = (select auth.uid())
  )
);
drop policy if exists journey_review_steps_owner_insert on public.myryra_journey_review_steps;
create policy journey_review_steps_owner_insert on public.myryra_journey_review_steps
for insert to authenticated with check (
  owner_id = (select auth.uid()) and exists (
    select 1 from public.myryra_journey_missions m
    join public.myryra_journeys j on j.id = m.journey_id
    where m.id = mission_id and j.owner_id = (select auth.uid())
  )
);
drop policy if exists journey_review_steps_owner_update on public.myryra_journey_review_steps;
create policy journey_review_steps_owner_update on public.myryra_journey_review_steps
for update to authenticated using (
  owner_id = (select auth.uid()) and exists (
    select 1 from public.myryra_journey_missions m
    join public.myryra_journeys j on j.id = m.journey_id
    where m.id = mission_id and j.owner_id = (select auth.uid())
  )
) with check (
  owner_id = (select auth.uid()) and exists (
    select 1 from public.myryra_journey_missions m
    join public.myryra_journeys j on j.id = m.journey_id
    where m.id = mission_id and j.owner_id = (select auth.uid())
  )
);
