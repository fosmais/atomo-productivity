-- MVP2: immutable server-issued exercises for Journey assessments.
-- Foundation only: grading must not use this table until API and completion gates
-- are upgraded together and integration-tested.
create table if not exists public.myryra_journey_assigned_exercises (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.myryra_journey_missions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.mika_teacher_sessions(id) on delete set null,
  version integer not null check (version > 0),
  exercise text not null check (char_length(btrim(exercise)) between 10 and 600),
  created_at timestamptz not null default now(),
  unique (mission_id, version)
);
create index if not exists myryra_assigned_exercises_owner_mission_idx
  on public.myryra_journey_assigned_exercises(owner_id, mission_id, version desc);
alter table public.myryra_journey_assigned_exercises enable row level security;
revoke all on public.myryra_journey_assigned_exercises from public, anon, authenticated;
grant select on public.myryra_journey_assigned_exercises to authenticated;
drop policy if exists "Owner reads assigned exercises" on public.myryra_journey_assigned_exercises;
create policy "Owner reads assigned exercises"
  on public.myryra_journey_assigned_exercises for select to authenticated
  using (owner_id = (select auth.uid()) and exists (
    select 1 from public.myryra_journeys j
    join public.myryra_journey_missions m on m.journey_id = j.id
    where m.id = mission_id and j.owner_id = (select auth.uid())
  ));
-- No client insert/update/delete privileges or policies. Server must validate
-- ownership and issue the exercise through a privileged, audited operation.
