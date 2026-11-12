create table if not exists public.myryra_journey_snapshot_confirmations (
 snapshot_id uuid primary key references public.myryra_journey_draft_snapshots(id) on delete restrict,
 owner_id uuid not null references auth.users(id) on delete cascade,
 journey_id uuid not null unique references public.myryra_journeys(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.myryra_journey_snapshot_confirmations enable row level security;
revoke all on public.myryra_journey_snapshot_confirmations from anon,authenticated;
grant select,insert on public.myryra_journey_snapshot_confirmations to authenticated;
drop policy if exists journey_snapshot_confirmation_owner_select on public.myryra_journey_snapshot_confirmations;
create policy journey_snapshot_confirmation_owner_select on public.myryra_journey_snapshot_confirmations for select to authenticated using (owner_id=(select auth.uid()));
drop policy if exists journey_snapshot_confirmation_owner_insert on public.myryra_journey_snapshot_confirmations;
create policy journey_snapshot_confirmation_owner_insert on public.myryra_journey_snapshot_confirmations for insert to authenticated with check (owner_id=(select auth.uid()) and exists(select 1 from public.myryra_journeys j where j.id=journey_id and j.owner_id=(select auth.uid())) and exists(select 1 from public.myryra_journey_draft_snapshots s where s.id=snapshot_id and s.owner_id=(select auth.uid())));
create or replace function public.myryra_confirm_journey_snapshot_atomic(
 p_title text,p_target_date date,p_confirmation_key uuid,p_mission_titles text[],p_snapshot_id uuid
) returns table(journey_id uuid,mission_count integer)
language plpgsql security invoker set search_path='' as $$
declare v_owner uuid := (select auth.uid()); v_journey uuid; v_count integer; v_link uuid;
begin
 if v_owner is null or p_snapshot_id is null then raise exception 'Authentication and snapshot required' using errcode='28000'; end if;
 if not exists(select 1 from public.myryra_journey_draft_snapshots s where s.id=p_snapshot_id and s.owner_id=v_owner and s.expires_at>now()) then
  raise exception 'Snapshot unavailable' using errcode='22023';
 end if;
 select r.journey_id,r.mission_count into v_journey,v_count
 from public.myryra_confirm_journey_atomic(p_title,p_target_date,p_confirmation_key,p_mission_titles) r;
 insert into public.myryra_journey_snapshot_confirmations(snapshot_id,owner_id,journey_id)
 values(p_snapshot_id,v_owner,v_journey) on conflict (snapshot_id) do nothing;
 select c.journey_id into v_link from public.myryra_journey_snapshot_confirmations c where c.snapshot_id=p_snapshot_id and c.owner_id=v_owner;
 if v_link is distinct from v_journey then
  raise exception 'Snapshot already confirmed' using errcode='23505';
 end if;
 return query select v_journey,v_count;
end $$;
revoke all on function public.myryra_confirm_journey_snapshot_atomic(text,date,uuid,text[],uuid) from public,anon;
grant execute on function public.myryra_confirm_journey_snapshot_atomic(text,date,uuid,text[],uuid) to authenticated;