-- MIKA Agent approved-task idempotency. Homologation only; no persistent data.
BEGIN;
DO $test$
DECLARE
 v_user uuid := gen_random_uuid();
 v_plan uuid := gen_random_uuid();
 v_prop uuid := gen_random_uuid();
 v_status text;
 v_task uuid;
 v_again text;
 v_task_again uuid;
BEGIN
 INSERT INTO auth.users(id,instance_id,aud,role,email)
 VALUES(v_user,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
        'mika-exec-'||v_user||'@example.invalid');
 INSERT INTO public.plans(id,user_id,title)
 VALUES(v_plan,v_user,'Plano teste MIKA');
 INSERT INTO public.mika_action_proposals(id,user_id,action_type,payload,status,approved_at)
 VALUES(v_prop,v_user,'create_task',
        jsonb_build_object('type','create_task','title','Tarefa de teste MIKA',
                           'reason','Teste de idempotencia','due_at',null,'plan_id',v_plan::text),
        'approved',now());

 PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
 SET LOCAL ROLE authenticated;
 SELECT execution_status,task_id INTO v_status,v_task
 FROM public.mika_execute_approved_task(v_prop,v_plan);
 SELECT execution_status,task_id INTO v_again,v_task_again
 FROM public.mika_execute_approved_task(v_prop,v_plan);
 RESET ROLE;

 IF v_status <> 'executed' OR v_task IS NULL THEN RAISE EXCEPTION 'First execution failed'; END IF;
 IF v_again <> 'already_executed' OR v_task_again IS DISTINCT FROM v_task
 THEN RAISE EXCEPTION 'Idempotency failed'; END IF;
 IF (SELECT count(*) FROM public.tasks WHERE id=v_task AND user_id=v_user AND plan_id=v_plan) <> 1
 THEN RAISE EXCEPTION 'Task not created'; END IF;
 IF (SELECT count(*) FROM public.mika_action_audit
     WHERE proposal_id=v_prop AND event_type='succeeded') <> 1
 THEN RAISE EXCEPTION 'Unexpected audit count'; END IF;
END $test$;
ROLLBACK;
