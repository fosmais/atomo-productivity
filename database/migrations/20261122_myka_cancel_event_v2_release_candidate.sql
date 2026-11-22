-- MIKA Concierge V2: atomic cancellation, same per-user advisory lock as confirmation.
create or replace function public.myka_cancel_event_v2(p_message_id uuid, p_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_status text;
begin
  if p_message_id is null or p_user_id is null then
    return jsonb_build_object('status','invalid');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 619822));
  select event_status into v_status from public.myka_messages
    where id=p_message_id and user_id=p_user_id and role='assistant' for update;
  if not found then return jsonb_build_object('status','missing'); end if;
  if v_status is distinct from 'pending' then return jsonb_build_object('status','unavailable'); end if;
  update public.myka_messages set event_status='cancelled'
    where id=p_message_id and user_id=p_user_id and role='assistant' and event_status='pending';
  return jsonb_build_object('status','cancelled');
end $$;
revoke all on function public.myka_cancel_event_v2(uuid,uuid) from public,anon,authenticated;
grant execute on function public.myka_cancel_event_v2(uuid,uuid) to service_role;
