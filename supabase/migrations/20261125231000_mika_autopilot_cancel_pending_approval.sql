alter table public.mika_autopilot_approvals drop constraint mika_autopilot_approvals_execution_status_check, add constraint mika_autopilot_approvals_execution_status_check check(execution_status in ('pending','executed','cancelled'));
alter table public.mika_autopilot_audit drop constraint mika_autopilot_audit_action_check, add constraint mika_autopilot_audit_action_check check(action in ('approval_recorded','execution_completed','approval_cancelled'));
create function public.cancel_mika_autopilot_approval(p_approval_id uuid,p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.mika_autopilot_approvals%rowtype;
begin
perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
select * into a from public.mika_autopilot_approvals where id=p_approval_id and user_id=p_user_id for update;
if not found then raise exception 'APPROVAL_NOT_FOUND' using errcode='P0002'; end if;
if a.execution_status='cancelled' then return; end if;
if a.execution_status<>'pending' then raise exception 'APPROVAL_NOT_PENDING' using errcode='P0001'; end if;
update public.mika_autopilot_approvals set execution_status='cancelled' where id=p_approval_id and user_id=p_user_id;
insert into public.mika_autopilot_audit(user_id,approval_id,action,event_ids,metadata) values(p_user_id,p_approval_id,'approval_cancelled','{}','{}');
end $$;
revoke all on function public.cancel_mika_autopilot_approval(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cancel_mika_autopilot_approval(uuid,uuid) to service_role;