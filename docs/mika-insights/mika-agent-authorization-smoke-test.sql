-- MIKA Agent authorization and idempotency regression (PREVIEW ONLY).
-- Requires two existing auth.users. Transaction is rolled back.
-- Tests real proposal ownership, approval, execution, audit and replay safety.
begin;
do $$
declare
  owner_id uuid;
  other_id uuid;
  v_plan_id uuid;
  v_proposal_id uuid;
  first_task_id uuid;
  replay_task_id uuid;
  rejected_proposal_id uuid;
  expired_proposal_id uuid;
  decision text;
  execution text;
  affected integer;
  rejected boolean;
begin
  select id into owner_id from auth.users order by id limit 1;
  select id into other_id from auth.users where id <> owner_id order by id limit 1;
  if owner_id is null or other_id is null then
    raise exception 'Two existing users required for Preview smoke test';
  end if;

  insert into public.plans(user_id,title)
  values(owner_id,'MIKA Agent smoke test - rollback')
  returning id into v_plan_id;

  insert into public.mika_action_proposals(user_id,action_type,payload,status)
  values(owner_id,'create_task',
    jsonb_build_object('type','create_task','title','Authorized smoke test task',
      'reason','Authorization regression','due_at',null,'plan_id',v_plan_id::text),
    'pending')
  returning id into v_proposal_id;

  perform set_config('request.jwt.claim.sub',other_id::text,true);
  execute 'set local role authenticated';
  rejected := false;
  begin
    perform * from public.mika_decide_proposal(v_proposal_id,true);
  exception when sqlstate 'P0002' then rejected := true;
  end;
  if not rejected then raise exception 'Cross-user approval allowed'; end if;

  rejected := false;
  begin
    perform * from public.mika_execute_approved_task(v_proposal_id,v_plan_id);
  exception when sqlstate 'P0002' then rejected := true;
  end;
  if not rejected then raise exception 'Cross-user execution allowed'; end if;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  rejected := false;
  begin
    perform * from public.mika_execute_approved_task(v_proposal_id,v_plan_id);
  exception when sqlstate 'P0001' then rejected := true;
  end;
  if not rejected then raise exception 'Pending proposal executed'; end if;

  select decision_status into decision
  from public.mika_decide_proposal(v_proposal_id,true);
  if decision <> 'approved' then raise exception 'Approval failed'; end if;

  -- A different plan ID cannot be substituted after approval.
  rejected := false;
  begin
    perform * from public.mika_execute_approved_task(v_proposal_id,gen_random_uuid());
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then raise exception 'Plan substitution was allowed'; end if;

  select execution_status,task_id into execution,first_task_id
  from public.mika_execute_approved_task(v_proposal_id,v_plan_id);
  if execution <> 'executed' or first_task_id is null then
    raise exception 'Approved task execution failed';
  end if;

  select execution_status,task_id into execution,replay_task_id
  from public.mika_execute_approved_task(v_proposal_id,v_plan_id);
  if execution <> 'already_executed' or replay_task_id is distinct from first_task_id then
    raise exception 'Replay/idempotency failed';
  end if;

  -- Replay cannot change the plan associated with the already executed task.
  rejected := false;
  begin
    perform * from public.mika_execute_approved_task(v_proposal_id,gen_random_uuid());
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then raise exception 'Replay accepted a different plan'; end if;

  select count(*) into affected from public.tasks
  where tasks.plan_id=v_plan_id and user_id=owner_id and id=first_task_id;
  if affected <> 1 then raise exception 'Task missing or duplicated'; end if;

  select count(*) into affected from public.mika_action_audit
  where mika_action_audit.proposal_id=v_proposal_id and event_type in ('approved','succeeded');
  if affected <> 2 then raise exception 'Approval/execution audit missing'; end if;

  -- Rejected proposals must never execute.
  execute 'reset role';
  insert into public.mika_action_proposals(user_id,action_type,payload,status)
  values(owner_id,'create_task',
    jsonb_build_object('type','create_task','title','Rejected smoke test task',
      'reason','Authorization regression','due_at',null,'plan_id',v_plan_id::text),
    'rejected')
  returning id into rejected_proposal_id;
  execute 'set local role authenticated';
  rejected := false;
  begin
    perform * from public.mika_execute_approved_task(rejected_proposal_id,v_plan_id);
  exception when sqlstate 'P0001' then rejected := true;
  end;
  if not rejected then raise exception 'Rejected proposal executed'; end if;

  -- Expired approvals must not create tasks.
  execute 'reset role';
  insert into public.mika_action_proposals(user_id,action_type,payload,status,created_at,expires_at)
  values(owner_id,'create_task',
    jsonb_build_object('type','create_task','title','Expired smoke test task',
      'reason','Authorization regression','due_at',null,'plan_id',v_plan_id::text),
    'approved',now()-interval '2 hours',now()-interval '1 hour')
  returning id into expired_proposal_id;
  execute 'set local role authenticated';
  select execution_status into execution
  from public.mika_execute_approved_task(expired_proposal_id,v_plan_id);
  if execution <> 'expired' then raise exception 'Expired proposal executed'; end if;

  select count(*) into affected from public.tasks
  where tasks.plan_id=v_plan_id and user_id=owner_id;
  if affected <> 1 then raise exception 'Unexpected extra task created'; end if;
end $$;
rollback;
