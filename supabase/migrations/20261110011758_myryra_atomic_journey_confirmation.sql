create or replace function public.myryra_confirm_journey_atomic(
  p_title text, p_target_date date, p_confirmation_key uuid, p_mission_titles text[]
) returns table(journey_id uuid, mission_count integer)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_id uuid;
  v_existing record;
  v_titles text[];
  v_stored text[];
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_confirmation_key is null or p_title is null or length(btrim(p_title))=0 or length(p_title)>120
    or p_mission_titles is null or cardinality(p_mission_titles) not between 1 and 104
    or exists (select 1 from unnest(p_mission_titles) t where t is null or length(btrim(t))=0 or length(t)>160)
  then raise exception 'Invalid journey' using errcode='22023'; end if;
  insert into public.myryra_journeys(owner_id,title,target_date,confirmation_key,status,visibility)
    values(v_owner,p_title,p_target_date,p_confirmation_key,'active','private')
    on conflict (owner_id,confirmation_key) where confirmation_key is not null do nothing
    returning id into v_id;
  if v_id is not null then
    insert into public.myryra_journey_missions(journey_id,title,status)
      select v_id,t,'pending' from unnest(p_mission_titles) as t;
    return query select v_id,cardinality(p_mission_titles);
    return;
  end if;
  select j.id,j.title,j.target_date into v_existing
    from public.myryra_journeys j
    where j.owner_id=v_owner and j.confirmation_key=p_confirmation_key;
  if not found then raise exception 'Confirmation unavailable' using errcode='40001'; end if;
  if v_existing.title is distinct from p_title or v_existing.target_date is distinct from p_target_date then
    raise exception 'Confirmation used for different goal' using errcode='22023';
  end if;
  select array_agg(t order by t) into v_titles from unnest(p_mission_titles) as t;
  select array_agg(m.title order by m.title) into v_stored
    from public.myryra_journey_missions m where m.journey_id=v_existing.id;
  if v_titles is distinct from v_stored then
    raise exception 'Confirmation used for different missions' using errcode='22023';
  end if;
  return query select v_existing.id,cardinality(p_mission_titles);
end;
$$;
revoke all on function public.myryra_confirm_journey_atomic(text,date,uuid,text[]) from public,anon;
grant execute on function public.myryra_confirm_journey_atomic(text,date,uuid,text[]) to authenticated;