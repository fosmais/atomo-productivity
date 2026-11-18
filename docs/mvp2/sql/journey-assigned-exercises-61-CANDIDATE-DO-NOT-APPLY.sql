-- ISSUE #61 — REVIEW ONLY. DO NOT APPLY to PROD or staging without explicit release gate.
-- Candidate for an environment where assigned_exercises is absent.
-- Deliberately NOT under supabase/migrations to prevent automatic deployment.
begin;
do $preflight$
begin
  if to_regclass('public.myryra_journey_assigned_exercises') is not null then
    raise exception 'Existing assigned exercises table: reconcile drift manually, do not overwrite';
  end if;
  if to_regclass('public.myryra_journey_missions') is null
     or to_regclass('public.myryra_journeys') is null
     or to_regclass('public.mika_teacher_sessions') is null then
    raise exception 'Journey/teacher dependencies missing';
  end if;
end;
$preflight$;

create table public.myryra_journey_assigned_exercises (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.myryra_journey_missions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.mika_teacher_sessions(id) on delete set null,
  version integer not null check (version > 0),
  exercise text not null check (char_length(btrim(exercise)) between 10 and 600),
  created_at timestamptz not null default now(),
  constraint myryra_journey_assigned_exercises_mission_id_version_key unique (mission_id, version)
);
create index myryra_assigned_exercises_owner_mission_idx
  on public.myryra_journey_assigned_exercises (owner_id, mission_id, version desc);

create function public.myryra_validate_assigned_exercise()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  actual_owner uuid;
  actual_journey uuid;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Exercicios oficiais sao imutaveis; emita uma nova versao.'
      using errcode = '23514';
  end if;
  select j.owner_id, j.id into actual_owner, actual_journey
    from public.myryra_journey_missions m
    join public.myryra_journeys j on j.id = m.journey_id
    where m.id = new.mission_id;
  if actual_owner is null or actual_owner is distinct from new.owner_id then
    raise exception 'Proprietario do exercicio nao corresponde a missao.'
      using errcode = '23514';
  end if;
  if new.session_id is not null and not exists (
    select 1 from public.mika_teacher_sessions s
    where s.id = new.session_id and s.owner_id = actual_owner
      and s.mission_id = new.mission_id and s.journey_id = actual_journey
  ) then
    raise exception 'Aula nao corresponde a missao e proprietario.'
      using errcode = '23514';
  end if;
  return new;
end;
$fn$;
revoke all on function public.myryra_validate_assigned_exercise() from public, anon, authenticated;
create trigger myryra_validate_assigned_exercise
  before insert or update on public.myryra_journey_assigned_exercises
  for each row execute function public.myryra_validate_assigned_exercise();

alter table public.myryra_journey_assigned_exercises enable row level security;
revoke all on public.myryra_journey_assigned_exercises from public, anon, authenticated;
grant select on public.myryra_journey_assigned_exercises to authenticated;
create policy "Owner reads assigned exercises"
  on public.myryra_journey_assigned_exercises
  for select to authenticated
  using (owner_id = (select auth.uid()) and exists (
    select 1 from public.myryra_journey_missions m
    join public.myryra_journeys j on j.id = m.journey_id
    where m.id = mission_id and j.owner_id = (select auth.uid())
  ));
-- Deliberately no service_role write grants: must first verify the issuer endpoint
-- and its actual database role, then explicitly approve minimum permissions.
commit;
