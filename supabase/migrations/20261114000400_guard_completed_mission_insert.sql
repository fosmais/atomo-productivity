-- Prevent a client from creating a mission already completed and earning MYRA without assessment.
-- Trusted service_role may create completed missions for authorized server workflows.
create or replace function public.myryra_guard_client_completed_mission_insert()
returns trigger language plpgsql security invoker set search_path = '' as $guard$
begin
  if new.status = 'completed' and current_user in ('authenticated', 'anon') then
    raise exception 'Mission completion must be authorized by the server' using errcode = '42501';
  end if;
  return new;
end;
$guard$;
revoke all on function public.myryra_guard_client_completed_mission_insert() from public, anon, authenticated;
drop trigger if exists myryra_guard_completed_mission_insert on public.myryra_journey_missions;
create trigger myryra_guard_completed_mission_insert
before insert on public.myryra_journey_missions
for each row execute function public.myryra_guard_client_completed_mission_insert();