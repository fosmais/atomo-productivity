-- Stale replan replay regression. Execute ONLY in a disposable/homologation database.
-- Creates a synthetic auth identity and journey; all changes are rolled back.
BEGIN;
DO $test$
DECLARE
 v_owner uuid := gen_random_uuid();
 v_journey uuid := gen_random_uuid();
 v_revision text;
 v_result jsonb;
 v_rejected boolean := false;
BEGIN
 INSERT INTO auth.users(id,instance_id,aud,role,email)
 VALUES(v_owner,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
        'mvp2-stale-'||v_owner::text||'@example.invalid');
 PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
 INSERT INTO public.myryra_journeys(id,owner_id,title,status)
 VALUES(v_journey,v_owner,'TESTE REVISAO DESCARTAVEL','active');
 INSERT INTO public.myryra_journey_missions(journey_id,title,status)
 VALUES(v_journey,'Pendente original','pending');
 SELECT to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
 INTO v_revision FROM public.myryra_journeys WHERE id=v_journey;
 v_result := public.myryra_apply_journey_replan_atomic(v_journey,v_revision,ARRAY['Nova missao 1']);
 BEGIN
  PERFORM public.myryra_apply_journey_replan_atomic(v_journey,v_revision,ARRAY['Nova missao 2']);
 EXCEPTION WHEN SQLSTATE '40001' THEN v_rejected := true;
 END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'REPLAY ACCEPTED'; END IF;
 IF (SELECT count(*) FROM public.myryra_journey_missions
     WHERE journey_id=v_journey AND title='Nova missao 1' AND status='pending') <> 1
 THEN RAISE EXCEPTION 'First replan missing'; END IF;
 IF EXISTS (SELECT 1 FROM public.myryra_journey_missions
            WHERE journey_id=v_journey AND title='Nova missao 2')
 THEN RAISE EXCEPTION 'Stale replan modified missions'; END IF;
 IF EXISTS (SELECT 1 FROM public.myryra_journey_myra_ledger WHERE journey_id=v_journey)
 THEN RAISE EXCEPTION 'Unexpected MYRA credit'; END IF;
END $test$;
ROLLBACK;
