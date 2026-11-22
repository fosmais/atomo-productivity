-- MYRYRA MVP2 / staging-only proposal. Do not apply to PROD without API change and concurrency tests.
-- Stores the event identity for idempotent retries.
alter table public.myka_messages add column if not exists confirmed_event_id uuid references public.events(id) on delete set null;

create or replace function public.myka_confirm_event_v2(
  p_message_id uuid, p_user_id uuid, p_acknowledge_conflict boolean default false
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  m record; e jsonb; v_start timestamptz; v_end timestamptz;
  v_event uuid; v_conflicts integer; v_title text; v_location text; v_notes text;
begin
  if p_message_id is null or p_user_id is null then return jsonb_build_object('status','invalid'); end if;
  -- Serialize confirmations of *different* proposals for the same user.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 619822));
  select proposed_event,event_status,confirmed_event_id into m
    from public.myka_messages
    where id=p_message_id and user_id=p_user_id and role='assistant' for update;
  if not found then return jsonb_build_object('status','missing'); end if;
  if m.event_status='saved' then
    if m.confirmed_event_id is null then return jsonb_build_object('status','legacy_saved'); end if;
    return jsonb_build_object('status','saved','eventId',m.confirmed_event_id);
  end if;
  if m.event_status is distinct from 'pending' then
    return jsonb_build_object('status','unavailable');
  end if;
  e := m.proposed_event;
  if e is null or jsonb_typeof(e)<>'object' then return jsonb_build_object('status','invalid'); end if;
  v_title := btrim(e->>'title');
  if v_title is null or length(v_title) not between 1 and 200
    or coalesce(e->>'startsAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
    or coalesce(e->>'endsAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
  then return jsonb_build_object('status','invalid'); end if;
  begin
    v_start := (e->>'startsAt')::timestamptz;
    v_end := (e->>'endsAt')::timestamptz;
  exception when others then return jsonb_build_object('status','invalid'); end;
  if v_end<=v_start or v_start < now()-interval '60 seconds'
  then return jsonb_build_object('status','expired_or_invalid'); end if;
  select count(*) into v_conflicts from public.events
    where user_id=p_user_id and deleted_at is null
      and starts_at<v_end and ends_at>v_start;
  if v_conflicts>0 and not coalesce(p_acknowledge_conflict,false) then
    return jsonb_build_object('status','conflict','conflictCount',v_conflicts);
  end if;
  v_location := nullif(left(coalesce(e->>'location',''),500),'');
  v_notes := nullif(left(coalesce(e->>'notes',''),2000),'');
  insert into public.events(user_id,title,starts_at,ends_at,location,notes,event_type,blocks_time)
  values(p_user_id,v_title,v_start,v_end,v_location,v_notes,
    case when e->>'eventType'='unavailable' then 'unavailable' else 'appointment' end,
    case when jsonb_typeof(e->'blocksTime')='boolean' then (e->>'blocksTime')::boolean else true end)
  returning id into v_event;
  update public.myka_messages set event_status='saved',confirmed_event_id=v_event
    where id=p_message_id and user_id=p_user_id;
  return jsonb_build_object('status','saved','eventId',v_event);
end $$;

revoke all on function public.myka_confirm_event_v2(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.myka_confirm_event_v2(uuid,uuid,boolean) to service_role;
