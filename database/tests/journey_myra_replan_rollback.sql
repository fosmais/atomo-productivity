-- Journey MYRA preservation acceptance test. Run in a controlled environment.
-- All changes are rolled back; uses an existing auth.users row as test context.
BEGIN;
DO $test$
DECLARE
  v_owner uuid;
  v_journey uuid := gen_random_uuid();
  v_completed uuid;
  v_ledger uuid;
  v_revision text;
BEGIN
  SELECT id INTO v_owner FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'No test identity available'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  INSERT INTO public.myryra_journeys(id,owner_id,title,status)
  VALUES(v_journey,v_owner,'TESTE MYRA DESCARTAVEL','active');
  INSERT INTO public.myryra_journey_missions(journey_id,title,status)
  VALUES(v_journey,'Marco concluido','pending'),(v_journey,'Pendente antiga','pending');
  SELECT id INTO v_completed FROM public.myryra_journey_missions
  WHERE journey_id=v_journey AND title='Marco concluido';
  UPDATE public.myryra_journey_missions SET status='completed',completed_at=now() WHERE id=v_completed;
  SELECT id INTO v_ledger FROM public.myryra_journey_myra_ledger
  WHERE mission_id=v_completed AND amount=10;
  IF v_ledger IS NULL THEN RAISE EXCEPTION 'Initial MYRA credit missing'; END IF;
  SELECT to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  INTO v_revision FROM public.myryra_journeys WHERE id=v_journey;
  PERFORM public.myryra_apply_journey_replan_atomic(v_journey,v_revision,
    ARRAY['Nova etapa 1','Nova etapa 2']);
  IF NOT EXISTS (SELECT 1 FROM public.myryra_journey_myra_ledger
    WHERE id=v_ledger AND mission_id=v_completed AND amount=10)
  THEN RAISE EXCEPTION 'MYRA credit lost'; END IF;
  IF (SELECT count(*) FROM public.myryra_journey_myra_ledger WHERE journey_id=v_journey)<>1
  THEN RAISE EXCEPTION 'Unexpected MYRA credit'; END IF;
  IF (SELECT count(*) FROM public.myryra_journey_missions
    WHERE journey_id=v_journey AND status='completed')<>1
  THEN RAISE EXCEPTION 'Completed mission lost'; END IF;
  IF (SELECT count(*) FROM public.myryra_journey_missions
    WHERE journey_id=v_journey AND status='pending')<>2
  THEN RAISE EXCEPTION 'Pending missions not replaced'; END IF;
END $test$;
ROLLBACK;
