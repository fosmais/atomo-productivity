-- MIKA Agent expired approved proposal: single expiry audit, no task, replay denied.
-- Run only in isolated staging. Entire test is rolled back.
BEGIN;
DO $test$
DECLARE
  v_user uuid := gen_random_uuid();
  v_plan uuid := gen_random_uuid();
  v_proposal uuid := gen_random_uuid();
  v_status text;
  v_task uuid;
  v_replay_denied boolean := false;
BEGIN
  INSERT INTO auth.users(id,instance_id,aud,role,email)
  VALUES (v_user,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
          'mika-expired-'||v_user||'@example.invalid');
  INSERT INTO public.plans(id,user_id,title)
  VALUES (v_plan,v_user,'[MIKA-STAGING-TEST] Expiry rollback');
  INSERT INTO public.mika_action_proposals(
    id,user_id,action_type,payload,status,created_at,approved_at,expires_at
  ) VALUES (
    v_proposal,v_user,'create_task',
    jsonb_build_object('type','create_task','title','[MIKA-STAGING-TEST] Expired task',
                       'reason','Expiry regression','due_at',null,'plan_id',v_plan::text),
    'approved',now()-interval '3 hours',now()-interval '2 hours',now()-interval '1 hour'
  );

  PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
  SET LOCAL ROLE authenticated;
  SELECT execution_status,task_id INTO v_status,v_task
  FROM public.mika_execute_approved_task(v_proposal,v_plan);
  IF v_status IS DISTINCT FROM 'expired' OR v_task IS NOT NULL
  THEN RAISE EXCEPTION 'Expired proposal executed'; END IF;

  BEGIN
    PERFORM public.mika_execute_approved_task(v_proposal,v_plan);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    v_replay_denied := true;
  END;
  RESET ROLE;

  IF NOT v_replay_denied THEN RAISE EXCEPTION 'Expired replay was not denied'; END IF;
  IF (SELECT status FROM public.mika_action_proposals WHERE id=v_proposal) <> 'expired'
  THEN RAISE EXCEPTION 'Wrong proposal status'; END IF;
  IF (SELECT count(*) FROM public.mika_action_audit
      WHERE proposal_id=v_proposal AND event_type='expired') <> 1
  THEN RAISE EXCEPTION 'Wrong expiry audit count'; END IF;
  IF (SELECT count(*) FROM public.tasks WHERE user_id=v_user AND plan_id=v_plan) <> 0
  THEN RAISE EXCEPTION 'Expired proposal created a task'; END IF;
END $test$;
ROLLBACK;
