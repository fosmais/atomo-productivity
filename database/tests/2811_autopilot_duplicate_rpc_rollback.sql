-- MYRYRA 28.11: sequential RPC regression, rollback-only.
-- Confirms first reservation succeeds and the same task cannot be reserved twice.
-- This is NOT a two-session concurrency test.
BEGIN;
CREATE TEMP TABLE myryra_test_result(status text) ON COMMIT DROP;
GRANT INSERT, SELECT ON myryra_test_result TO authenticated;
DO $$
DECLARE v_task record; v_start timestamptz := now() + interval '6 days';
BEGIN
 SELECT id,user_id,duration_minutes INTO v_task
 FROM public.tasks WHERE completed=false AND duration_minutes BETWEEN 5 AND 1440
 AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.user_id=tasks.user_id
 AND e.blocks_time AND e.starts_at < v_start + make_interval(mins=>tasks.duration_minutes)
 AND e.ends_at > v_start)
 AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.user_id=tasks.user_id
 AND e.notes='Tarefa MYRYRA: '||tasks.id::text)
 ORDER BY created_at DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'No eligible task fixture; test not executed'; END IF;
 PERFORM set_config('myryra.test.task',v_task.id::text,true);
 PERFORM set_config('myryra.test.duration',v_task.duration_minutes::text,true);
 PERFORM set_config('request.jwt.claim.sub',v_task.user_id::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_task uuid:=current_setting('myryra.test.task')::uuid;
 v_start timestamptz:=now()+interval '6 days';
 v_end timestamptz:=v_start+make_interval(mins=>current_setting('myryra.test.duration')::int);
 v_first uuid; v_blocked boolean:=false;
BEGIN
 v_first:=public.reserve_autopilot_task(v_task,v_start,v_end);
 IF v_first IS NULL THEN RAISE EXCEPTION 'First reservation returned null'; END IF;
 BEGIN
  PERFORM public.reserve_autopilot_task(v_task,v_start,v_end);
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Calendar conflict or duplicate reservation' THEN v_blocked:=true;
  ELSE RAISE; END IF;
 END;
 IF NOT v_blocked THEN RAISE EXCEPTION 'Duplicate RPC was accepted'; END IF;
 INSERT INTO pg_temp.myryra_test_result VALUES('PASS: first RPC accepted; second rejected');
END $$;
SELECT status FROM pg_temp.myryra_test_result;
ROLLBACK;
