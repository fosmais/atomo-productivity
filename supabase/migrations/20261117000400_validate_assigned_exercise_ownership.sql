-- Ensure server-issued assessment exercises belong to their actual mission owner.
-- A service-role client must not accidentally issue cross-owner or cross-session evidence.
create or replace function public.myryra_validate_assigned_exercise()
returns trigger language plpgsql security definer set search_path = '' as $$
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
$$;
revoke all on function public.myryra_validate_assigned_exercise() from public, anon, authenticated;
drop trigger if exists myryra_validate_assigned_exercise on public.myryra_journey_assigned_exercises;
create trigger myryra_validate_assigned_exercise
  before insert or update on public.myryra_journey_assigned_exercises
  for each row execute function public.myryra_validate_assigned_exercise();
