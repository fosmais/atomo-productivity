create table if not exists public.myryra_journey_myra_ledger (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 journey_id uuid not null references public.myryra_journeys(id) on delete cascade,
 mission_id uuid not null references public.myryra_journey_missions(id) on delete cascade,
 amount integer not null default 10 check (amount = 10),
 reason text not null default 'mission_completed' check (reason = 'mission_completed'),
 created_at timestamptz not null default now(),
 unique (mission_id)
);
create index if not exists myryra_myra_ledger_owner_created_idx on public.myryra_journey_myra_ledger(owner_id, created_at desc);
alter table public.myryra_journey_myra_ledger enable row level security;
revoke all on public.myryra_journey_myra_ledger from anon, authenticated;
grant select on public.myryra_journey_myra_ledger to authenticated;
create policy myra_owner_read on public.myryra_journey_myra_ledger for select to authenticated using ((select auth.uid()) = owner_id);
create or replace function public.myryra_credit_completed_mission()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
   insert into public.myryra_journey_myra_ledger(owner_id,journey_id,mission_id)
   select j.owner_id, j.id, new.id from public.myryra_journeys j where j.id = new.journey_id
   on conflict (mission_id) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function public.myryra_credit_completed_mission() from public, anon, authenticated;
drop trigger if exists myryra_mission_credit_myra on public.myryra_journey_missions;
create trigger myryra_mission_credit_myra after insert or update of status on public.myryra_journey_missions for each row execute function public.myryra_credit_completed_mission();
insert into public.myryra_journey_myra_ledger(owner_id,journey_id,mission_id)
select j.owner_id,j.id,m.id from public.myryra_journey_missions m join public.myryra_journeys j on j.id=m.journey_id
where m.status='completed' on conflict (mission_id) do nothing;