-- Keep earned MYRA credits when missions/journeys are deleted.
-- Account deletion still cascades via owner_id for privacy.
alter table public.myryra_journey_myra_ledger
  add column source_mission_id uuid;
update public.myryra_journey_myra_ledger
  set source_mission_id = mission_id
  where source_mission_id is null;
alter table public.myryra_journey_myra_ledger
  alter column source_mission_id set not null,
  add constraint myryra_journey_myra_ledger_source_mission_key unique (source_mission_id),
  alter column mission_id drop not null,
  alter column journey_id drop not null;
alter table public.myryra_journey_myra_ledger
  drop constraint myryra_journey_myra_ledger_mission_id_fkey,
  drop constraint myryra_journey_myra_ledger_journey_id_fkey;
alter table public.myryra_journey_myra_ledger
  add constraint myryra_journey_myra_ledger_mission_id_fkey
    foreign key (mission_id) references public.myryra_journey_missions(id) on delete set null,
  add constraint myryra_journey_myra_ledger_journey_id_fkey
    foreign key (journey_id) references public.myryra_journeys(id) on delete set null;
create or replace function public.myryra_credit_completed_mission()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    insert into public.myryra_journey_myra_ledger(owner_id,journey_id,mission_id,source_mission_id)
    select j.owner_id,j.id,new.id,new.id from public.myryra_journeys j where j.id = new.journey_id
    on conflict (source_mission_id) do nothing;
  end if;
  return new;
end;
$$;