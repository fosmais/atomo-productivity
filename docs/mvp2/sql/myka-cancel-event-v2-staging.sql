-- MYRYRA MVP2: staging-only cancellation RPC. Apply to PROD only alongside the matching API deployment and after E2E approval.
-- Uses the same per-user advisory lock as myka_confirm_event_v2.
create or replace function public.myka_cancel_event_v2(p_message_id uuid,p_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare m record;
begin
 if p_message_id is null or p_user_id is null then return jsonb_build_object('status','invalid'); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,619822));
 select event_status into m from public.myka_messages
 where id=p_message_id and user_id=p_user_id and role='assistant' for update;
 if not found then return jsonb_build_object('status','missing'); end if;
 if m.event_status='cancelled' then return jsonb_build_object('status','cancelled'); end if;
 if m.event_status is distinct from 'pending' then return jsonb_build_object('status','unavailable'); end if;
 update public.myka_messages set event_status='cancelled' where id=p_message_id and user_id=p_user_id;
 return jsonb_build_object('status','cancelled');
end $$;
revoke all on function public.myka_cancel_event_v2(uuid,uuid) from public,anon,authenticated;
grant execute on function public.myka_cancel_event_v2(uuid,uuid) to service_role;
