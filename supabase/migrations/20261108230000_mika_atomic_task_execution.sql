-- Atomic, idempotent task creation after explicit proposal approval.
create or replace function public.mika_execute_approved_task(p_proposal_id uuid, p_plan_id uuid)
returns table(execution_status text, task_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare p public.mika_action_proposals%rowtype; v_task uuid; v_title text; v_due date;
begin
 if auth.uid() is null then raise exception 'unauthenticated' using errcode='28000'; end if;
 select * into p from public.mika_action_proposals where id=p_proposal_id and user_id=auth.uid() for update;
 if not found then raise exception 'proposal_not_found' using errcode='P0002'; end if;
 if p.status='executed' and p.action_type='create_task' then
   return query select 'already_executed'::text,(p.result->>'task_id')::uuid; return;
 end if;
 if p.status <> 'approved' or p.action_type <> 'create_task' then
   raise exception 'proposal_not_approved_or_unsupported' using errcode='P0001';
 end if;
 if not exists(select 1 from public.plans where id=p_plan_id and user_id=auth.uid()) then
   raise exception 'plan_not_found' using errcode='P0002';
 end if;
 v_title := p.payload->>'title';
 if v_title is null or length(btrim(v_title)) < 1 or length(v_title)>200 then
   raise exception 'invalid_title' using errcode='22023';
 end if;
 if p.payload ? 'due_at' and p.payload->>'due_at' is not null then
   v_due := ((p.payload->>'due_at')::timestamptz at time zone 'UTC')::date;
 end if;
 insert into public.tasks(plan_id,user_id,title,due_date)
 values(p_plan_id,auth.uid(),v_title,v_due) returning id into v_task;
 update public.mika_action_proposals set status='executed',executed_at=now(),
 result=jsonb_build_object('task_id',v_task,'plan_id',p_plan_id)
 where id=p.id;
 insert into public.mika_action_audit(proposal_id,user_id,event_type,metadata)
 values(p.id,auth.uid(),'succeeded',jsonb_build_object('task_id',v_task));
 return query select 'executed'::text,v_task;
end $$;
revoke all on function public.mika_execute_approved_task(uuid,uuid) from public,anon;
grant execute on function public.mika_execute_approved_task(uuid,uuid) to authenticated;
