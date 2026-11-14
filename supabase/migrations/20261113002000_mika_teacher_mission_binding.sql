alter table public.mika_teacher_sessions add column if not exists mission_id uuid references public.myryra_journey_missions(id) on delete set null;
create index if not exists mika_teacher_sessions_mission_idx on public.mika_teacher_sessions(mission_id) where mission_id is not null;
create or replace function public.mika_teacher_session_mission_guard() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.mission_id is not null and not exists (
  select 1 from public.myryra_journey_missions m join public.myryra_journeys j on j.id=m.journey_id
  where m.id=new.mission_id and j.id=new.journey_id and j.owner_id=new.owner_id and j.status='active'
 ) then raise exception 'Missão não pertence à jornada ativa do usuário' using errcode='23514'; end if;
 return new;
end $$;
drop trigger if exists mika_teacher_session_mission_guard on public.mika_teacher_sessions;
create trigger mika_teacher_session_mission_guard before insert or update of mission_id,journey_id,owner_id on public.mika_teacher_sessions for each row execute function public.mika_teacher_session_mission_guard();