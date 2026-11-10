-- Atomic, owner-scoped replanning. Deploy after reviewing mission dependencies.
-- Keeps completed missions and MYRA ledger untouched.
create or replace function public.myryra_apply_journey_replan_atomic(
  p_journey_id uuid,
  p_expected_updated_at timestamptz,
  p_mission_titles text[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_journey public.myryra_journeys%rowtype;
  v_completed integer;
  v_removed integer;
  v_title text;
  v_clean text[] := array[]::text[];
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_expected_updated_at is null or p_mission_titles is null
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
  if v_completed + array_length(p_mission_titles, 1) > 104 then
    raise exception 'Too many missions' using errcode = '22023';
  end if;

  foreach v_title in array p_mission_titles loop
    if v_title is null or char_length(btrim(v_title)) not between 1 and 160 then
      raise exception 'Invalid mission title' using errcode = '22023';
    end if;
    v_title := btrim(v_title);
    if exists (select 1 from unnest(v_clean) as t(title) where lower(t.title) = lower(v_title))
      or exists (
        select 1 from public.myryra_journey_missions
        where journey_id = p_journey_id and status = 'completed'
          and lower(btrim(title)) = lower(v_title)
      ) then
      raise exception 'Duplicate or completed mission' using errcode = '22023';
    end if;
    v_clean := array_append(v_clean, v_title);
  end loop;

  delete from public.myryra_journey_missions
    where journey_id = p_journey_id and status = 'pending';
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
    'newPending', array_length(v_clean, 1)
  );
end;
$$;

revoke all on function public.myryra_apply_journey_replan_atomic(uuid,timestamptz,text[]) from public, anon;
grant execute on function public.myryra_apply_journey_replan_atomic(uuid,timestamptz,text[]) to authenticated;
