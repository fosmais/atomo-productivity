-- MYRYRA 28.11: conflict rejection regression test.
-- Execute in the Supabase SQL editor as an administrator.
-- All changes are rolled back. Uses an existing eligible task, without exposing data.
BEGIN;
DO $$
DECLARE
  v_task record;
  v_start timestamptz := now() + interval '36 hours';
  v_blocked boolean := false;
BEGIN
  SELECT id, user_id, duration_minutes INTO v_task
  FROM public.tasks
  WHERE completed = false AND duration_minutes BETWEEN 5 AND 1440
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE NOTICE 'SKIPPED: no eligible task fixture';
    RETURN;
  END IF;
  INSERT INTO public.events(user_id,title,starts_at,ends_at,event_type,blocks_time)
  VALUES (v_task.user_id, 'MYRYRA rollback-only conflict fixture',
          v_start - interval '15 minutes',
          v_start + make_interval(mins => v_task.duration_minutes) + interval '15 minutes',
          'appointment', true);
  PERFORM set_config('request.jwt.claim.sub', v_task.user_id::text, true);
  -- Test as the authenticated role, not as an admin bypassing RLS.
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.reserve_autopilot_task(
      v_task.id, v_start, v_start + make_interval(mins => v_task.duration_minutes));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Calendar conflict or duplicate reservation' THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: conflicting AutoPilot reservation was accepted';
  END IF;
  RAISE NOTICE 'PASS: conflict correctly rejected';
END $$;
ROLLBACK;
