CREATE OR REPLACE FUNCTION public.myryra_apply_journey_replan_atomic(p_journey_id uuid, p_expected_updated_at timestamp with time zone, p_mission_titles text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_owner uuid := (select auth.uid());
  v_journey public.myryra_journeys%rowtype;
  v_completed integer;
  v_removed integer;
  v_preserved_linked integer;
  v_title text;
  v_clean text[] := array[]::text[];
begin
  if v_owner is null or not mika_internal.mfa_session_allowed() then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_expected_updated_at is null or p_mission_titles is null
    or array_ndims(p_mission_titles) is distinct from 1
    or coalesce(array_length(p_mission_titles, 1), 0) not between 1 and 104 then
    raise exception 'Invalid replan' using errcode = '22023';
  end if;

  select * into v_journey
  from public.myryra_journeys
  where id = p_journey_id and owner_id = v_owner
  for update;
  if not found or v_journey.status <> 'active' then
    raise exception 'Active journey not found' using errcode = 'P0002';
  end if;
  if v_journey.updated_at is distinct from p_expected_updated_at then
    raise exception 'Journey changed; refresh preview' using errcode = '40001';
  end if;

  -- Lock the existing mission rows so concurrent completions cannot be discarded.
  perform 1 from public.myryra_journey_missions
    where journey_id = p_journey_id for update;
  select count(*) into v_completed from public.myryra_journey_missions
    where journey_id = p_journey_id and status = 'completed';
  select count(*) into v_preserved_linked
  from public.myryra_journey_missions m
  where m.journey_id = p_journey_id and m.status = 'pending'
    and (
      exists (select 1 from public.myryra_journey_myra_ledger l where l.mission_id = m.id)
      or exists (select 1 from public.myryra_journey_task_links t where t.mission_id = m.id)
    );
  if v_completed + v_preserved_linked + array_length(p_mission_titles, 1) > 104 then
    raise exception 'Too many missions' using errcode = '22023';
  end if;

  foreach v_title in array p_mission_titles loop
    if v_title is null or char_length(btrim(v_title)) not between 1 and 160 then
      raise exception 'Invalid mission title' using errcode = '22023';
    end if;
    v_title := btrim(v_title);
    if exists (select 1 from unnest(v_clean) as t(title) where translate(lower(t.title),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc') = translate(lower(v_title),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'))
      or exists (
        select 1 from public.myryra_journey_missions m
        where m.journey_id = p_journey_id
          and translate(lower(btrim(m.title)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc') = translate(lower(v_title),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
          and (m.status = 'completed' or (
            m.status = 'pending' and (
              exists (select 1 from public.myryra_journey_myra_ledger l where l.mission_id = m.id)
              or exists (select 1 from public.myryra_journey_task_links t where t.mission_id = m.id)
            )
          ))
      ) then
      raise exception 'Duplicate or completed mission' using errcode = '22023';
    end if;
    v_clean := array_append(v_clean, v_title);
  end loop;

  -- Keep pending missions linked to tasks or MYRA records; remove only
  -- unlinked pending missions. Never cascade-delete user history.
  delete from public.myryra_journey_missions m
    where m.journey_id = p_journey_id and m.status = 'pending'
      and not exists (select 1 from public.myryra_journey_myra_ledger l where l.mission_id = m.id)
      and not exists (select 1 from public.myryra_journey_task_links t where t.mission_id = m.id);
  get diagnostics v_removed = row_count;
  insert into public.myryra_journey_missions (journey_id, title, status)
    select p_journey_id, title, 'pending' from unnest(v_clean) as title;

  update public.myryra_journeys
    set updated_at = clock_timestamp()
    where id = p_journey_id and owner_id = v_owner;

  return jsonb_build_object(
    'journeyId', p_journey_id,
    'preservedCompleted', v_completed,
    'replacedPending', v_removed,
    'preservedLinkedPending', v_preserved_linked,
    'newPending', array_length(v_clean, 1)
  );
end;
$function$
;
revoke all on function public.myryra_apply_journey_replan_atomic(uuid,timestamptz,text[]) from public,anon;
grant execute on function public.myryra_apply_journey_replan_atomic(uuid,timestamptz,text[]) to authenticated,service_role;
