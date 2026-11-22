-- MVP2 issue #26: additive schema for explicit teacher-to-mission association.
-- Staging candidate only. Do not apply to production before RLS and regression tests.
do $preflight$
begin
  if to_regclass('public.mika_teacher_sessions') is null
     or to_regclass('public.myryra_journey_missions') is null
     or to_regclass('public.myryra_journey_learning_progress') is null then
    raise exception 'MIKA/Journey baseline ausente; aplique as migracoes anteriores.';
  end if;
end;
$preflight$;

-- A lesson can optionally target one mission. Existing lessons remain unlinked.
alter table public.mika_teacher_sessions
  add column if not exists mission_id uuid references public.myryra_journey_missions(id) on delete set null;

-- Trusted database guard: prevents linking a lesson to a mission from another journey.
create or replace function public.mika_teacher_validate_mission_link()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.mission_id is not null and not exists (
    select 1 from public.myryra_journey_missions m
    join public.myryra_journeys j on j.id = m.journey_id
    where m.id = new.mission_id
      and m.journey_id = new.journey_id
      and j.owner_id = new.owner_id
  ) then
    raise exception 'A missao deve pertencer a jornada e ao proprietario da aula.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.mika_teacher_validate_mission_link() from public, anon, authenticated;
drop trigger if exists mika_teacher_mission_link_guard on public.mika_teacher_sessions;
create trigger mika_teacher_mission_link_guard
  before insert or update of mission_id, journey_id, owner_id
  on public.mika_teacher_sessions
  for each row execute function public.mika_teacher_validate_mission_link();

create index if not exists mika_teacher_sessions_mission_idx
  on public.mika_teacher_sessions(owner_id, mission_id)
  where mission_id is not null;

-- Explicit classification: absence of a row means legacy/unclassified, NOT auto-approved.
create table if not exists public.myryra_journey_mission_assessment_policy (
  mission_id uuid primary key references public.myryra_journey_missions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  requires_assessment boolean not null,
  minimum_score integer not null default 70 check (minimum_score between 70 and 100),
  created_at timestamptz not null default now()
);
-- Ensure service-role writes cannot attach a policy to a different user's mission.
create or replace function public.myryra_validate_assessment_policy_owner()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.myryra_journey_missions m
    join public.myryra_journeys j on j.id = m.journey_id
    where m.id = new.mission_id and j.owner_id = new.owner_id
  ) then
    raise exception 'Politica de avaliacao deve pertencer ao proprietario da missao.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.myryra_validate_assessment_policy_owner() from public, anon, authenticated;
drop trigger if exists myryra_assessment_policy_owner_guard on public.myryra_journey_mission_assessment_policy;
create trigger myryra_assessment_policy_owner_guard
  before insert or update of mission_id, owner_id
  on public.myryra_journey_mission_assessment_policy
  for each row execute function public.myryra_validate_assessment_policy_owner();

alter table public.myryra_journey_mission_assessment_policy enable row level security;
revoke all on public.myryra_journey_mission_assessment_policy from public, anon, authenticated;
grant select on public.myryra_journey_mission_assessment_policy to authenticated;
drop policy if exists "assessment policy select own" on public.myryra_journey_mission_assessment_policy;
create policy "assessment policy select own"
  on public.myryra_journey_mission_assessment_policy
  for select to authenticated
  using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.myryra_journey_missions m
      join public.myryra_journeys j on j.id = m.journey_id
      where m.id = mission_id and j.owner_id = (select auth.uid())
    )
  );
-- No client INSERT/UPDATE/DELETE grants: only trusted server can classify missions.
-- Follow-up API must enforce the policy and retain the legacy assessment gate.
