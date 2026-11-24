-- MIKA Agent RPC authorization smoke tests. Run ONLY in homologation.
-- No persisted changes: entire test is rolled back.
BEGIN;
DO $test$
DECLARE
 v_dummy uuid := gen_random_uuid();
 v_anon_denied boolean;
 v_missing_denied boolean;
BEGIN
 v_anon_denied := false;
 BEGIN
  SET LOCAL ROLE anon;
  PERFORM * FROM public.mika_decide_proposal(v_dummy,true);
 EXCEPTION WHEN insufficient_privilege THEN v_anon_denied := true;
 END;
 RESET ROLE;
 IF NOT v_anon_denied THEN RAISE EXCEPTION 'Anonymous approval unexpectedly permitted'; END IF;

 v_anon_denied := false;
 BEGIN
  SET LOCAL ROLE anon;
  PERFORM * FROM public.mika_execute_approved_task(v_dummy,gen_random_uuid());
 EXCEPTION WHEN insufficient_privilege THEN v_anon_denied := true;
 END;
 RESET ROLE;
 IF NOT v_anon_denied THEN RAISE EXCEPTION 'Anonymous execution unexpectedly permitted'; END IF;

 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 SET LOCAL ROLE authenticated;
 v_missing_denied := false;
 BEGIN
  PERFORM * FROM public.mika_decide_proposal(v_dummy,true);
 EXCEPTION WHEN SQLSTATE 'P0002' THEN v_missing_denied := true;
 END;
 IF NOT v_missing_denied THEN RAISE EXCEPTION 'Unknown proposal approval unexpectedly permitted'; END IF;

 v_missing_denied := false;
 BEGIN
  PERFORM * FROM public.mika_execute_approved_task(v_dummy,gen_random_uuid());
 EXCEPTION WHEN SQLSTATE 'P0002' THEN v_missing_denied := true;
 END;
 IF NOT v_missing_denied THEN RAISE EXCEPTION 'Unknown proposal execution unexpectedly permitted'; END IF;
 RESET ROLE;
END $test$;
ROLLBACK;
