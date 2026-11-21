-- MYRYRA Journey: private learning drafts and AI feedback.
create table if not exists public.myryra_journey_learning_progress (
  mission_id uuid primary key references public.myryra_journey_missions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  answer text not null default '' check (char_length(answer) <= 2000),
  feedback text check (feedback is null or char_length(feedback) <= 5000),
  updated_at timestamptz not null default now()
);
create index if not exists myryra_journey_learning_progress_owner_idx on public.myryra_journey_learning_progress(owner_id);
alter table public.myryra_journey_learning_progress enable row level security;
revoke all on public.myryra_journey_learning_progress from anon;
grant select, insert, update, delete on public.myryra_journey_learning_progress to authenticated;
drop policy if exists journey_learning_owner_select on public.myryra_journey_learning_progress;
create policy journey_learning_owner_select on public.myryra_journey_learning_progress for select to authenticated
using (owner_id = (select auth.uid()) and exists (
  select 1 from public.myryra_journey_missions m
  join public.myryra_journeys j on j.id = m.journey_id
  where m.id = mission_id and j.owner_id = (select auth.uid())
));
drop policy if exists journey_learning_owner_insert on public.myryra_journey_learning_progress;
create policy journey_learning_owner_insert on public.myryra_journey_learning_progress for insert to authenticated
with check (owner_id = (select auth.uid()) and exists (
  select 1 from public.myryra_journey_missions m
  join public.myryra_journeys j on j.id = m.journey_id
  where m.id = mission_id and j.owner_id = (select auth.uid())
));
drop policy if exists journey_learning_owner_update on public.myryra_journey_learning_progress;
create policy journey_learning_owner_update on public.myryra_journey_learning_progress for update to authenticated
using (owner_id = (select auth.uid()) and exists (
  select 1 from public.myryra_journey_missions m
  join public.myryra_journeys j on j.id = m.journey_id
  where m.id = mission_id and j.owner_id = (select auth.uid())
))
with check (owner_id = (select auth.uid()) and exists (
  select 1 from public.myryra_journey_missions m
  join public.myryra_journeys j on j.id = m.journey_id
  where m.id = mission_id and j.owner_id = (select auth.uid())
));
drop policy if exists journey_learning_owner_delete on public.myryra_journey_learning_progress;
create policy journey_learning_owner_delete on public.myryra_journey_learning_progress for delete to authenticated
using (owner_id = (select auth.uid()));
