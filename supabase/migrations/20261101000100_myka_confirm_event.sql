-- MYKA event confirmation: atomic and scoped to authenticated user.
create or replace function public.myka_confirm_event(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_message public.myka_messages%rowtype;
  v_event jsonb;
  v_title text;
  v_start timestamptz;
  v_end timestamptz;
  v_type text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_message from public.myka_messages
    where id = p_message_id and user_id = v_user and role = 'assistant'
    for update;
  if not found then raise exception 'Proposal not found'; end if;
  if v_message.event_status = 'cancelled' then
    return jsonb_build_object('status','cancelled');
  end if;
  if v_message.event_status not in ('pending','saved') then
    raise exception 'Proposal unavailable';
  end if;
  v_event := v_message.proposed_event;
  if jsonb_typeof(v_event) <> 'object' then raise exception 'Invalid event'; end if;
  v_title := btrim(v_event->>'title');
  if v_title is null or length(v_title) < 1 or length(v_title) > 200 then
    raise exception 'Invalid title';
  end if;
  v_start := (v_event->>'startsAt')::timestamptz;
  v_end := (v_event->>'endsAt')::timestamptz;
  if v_start is null or v_end is null or v_end <= v_start then
    raise exception 'Invalid dates';
  end if;
  v_type := coalesce(v_event->>'eventType','appointment');
  if v_type not in ('appointment','unavailable') then raise exception 'Invalid type'; end if;
  insert into public.events (id,user_id,title,starts_at,ends_at,location,notes,event_type,blocks_time)
    values (p_message_id,v_user,v_title,v_start,v_end,
      nullif(btrim(v_event->>'location'),''),
      nullif(btrim(v_event->>'notes'),''),
      v_type,coalesce((v_event->>'blocksTime')::boolean,false))
    on conflict (id) do nothing;
  update public.myka_messages set event_status = 'saved'
    where id = p_message_id and user_id = v_user;
  return jsonb_build_object('status','saved');
end;
$$;
revoke all on function public.myka_confirm_event(uuid) from public, anon;
grant execute on function public.myka_confirm_event(uuid) to authenticated;
