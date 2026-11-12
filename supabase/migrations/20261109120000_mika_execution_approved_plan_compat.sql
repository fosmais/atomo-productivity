-- MYRYRA MIKA: forward-only compatibility migration.
-- Generated from validated finance homologation function snapshot.
-- Apply only after migration history is reconciled and release approved.
-- Do not apply the incompatible docs/sql/mika-agent-staging-proposals.sql.
-- Snapshot of corrected finance homologation function. Review and test before PROD.
CREATE OR REPLACE FUNCTION public.mika_execute_approved_task(p_proposal_id uuid, p_plan_id uuid)
 RETURNS TABLE(execution_status text, task_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 p public.mika_action_proposals%rowtype;
 v_user uuid := auth.uid();
 v_task uuid;
 v_title text;
 v_due date;
 v_payload_plan uuid;
begin
 if v_user is null then raise exception 'unauthenticated' using errcode='28000'; end if;
 select * into p from public.mika_action_proposals
 where id=p_proposal_id and user_id=v_user for update;
 if not found then raise exception 'proposal_not_found' using errcode='P0002'; end if;
 if p.status='executed' and p.action_type='create_task' then
   return query select 'already_executed'::text,(p.result->>'task_id')::uuid;
   return;
 end if;
 if p.status <> 'approved' or p.action_type <> 'create_task' or p.approved_at is null or p.approved_at > now() then
   raise exception 'proposal_not_approved_or_unsupported' using errcode='P0001';
 end if;
 -- Approval must be traceable to a matching owner-scoped audit event.
 if not exists (
   select 1 from public.mika_action_audit a
   where a.proposal_id=p.id and a.user_id=v_user
     and a.event_type='approved'
     and a.created_at >= p.created_at
     and a.created_at <= now()
 ) then
   raise exception 'approval_audit_missing' using errcode='P0001';
 end if;
 if p.expires_at <= now() then
   update public.mika_action_proposals set status='expired' where id=p.id;
   insert into public.mika_action_audit(proposal_id,user_id,event_type)
   values(p.id,v_user,'expired');
   return query select 'expired'::text,null::uuid;
   return;
 end if;
 if p.payload->>'plan_id' is null then
   raise exception 'missing_approved_plan' using errcode='22023';
 end if;
 v_payload_plan := (p.payload->>'plan_id')::uuid;
 if p_plan_id is distinct from v_payload_plan then
   raise exception 'plan_mismatch' using errcode='22023';
 end if;
 if not exists(select 1 from public.plans where id=v_payload_plan and user_id=v_user) then
   raise exception 'plan_not_found' using errcode='P0002';
 end if;
 v_title := p.payload->>'title';
 if v_title is null or length(btrim(v_title)) < 3 or length(v_title)>160 then
   raise exception 'invalid_title' using errcode='22023';
 end if;
 if p.payload ? 'due_at' and p.payload->>'due_at' is not null then
   v_due := ((p.payload->>'due_at')::timestamptz at time zone 'UTC')::date;
 end if;
 insert into public.tasks(plan_id,user_id,title,due_date)
 values(v_payload_plan,v_user,v_title,v_due) returning id into v_task;
 update public.mika_action_proposals set status='executed',executed_at=now(),
 result=jsonb_build_object('task_id',v_task,'plan_id',v_payload_plan)
 where id=p.id;
 insert into public.mika_action_audit(proposal_id,user_id,event_type,metadata)
 values(p.id,v_user,'succeeded',jsonb_build_object('task_id',v_task));
 return query select 'executed'::text,v_task;
end $function$
;

-- Explicit least-privilege API execution grants (no PUBLIC or anon access).
REVOKE ALL ON FUNCTION public.mika_execute_approved_task(uuid,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.mika_execute_approved_task(uuid,uuid) TO authenticated;
