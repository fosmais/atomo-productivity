-- MIKA Insights: suggestion and transcription quotas must be independent.
-- STAGING ONLY; test mutations are rolled back.
BEGIN;
CREATE TEMP TABLE _mika_checks(test text, passed boolean) ON COMMIT DROP;
DO $$
DECLARE u uuid; i integer; accepted boolean; n integer;
BEGIN
 SELECT id INTO u FROM auth.users ORDER BY id LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'Staging user required'; END IF;
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM set_config('role','authenticated',true);
 FOR i IN 1..12 LOOP
  accepted:=public.mika_consume_ai_quota('suggest');
  IF NOT accepted THEN RAISE EXCEPTION 'Suggest unexpectedly denied at %',i; END IF;
 END LOOP;
 accepted:=public.mika_consume_ai_quota('suggest');
 PERFORM set_config('role','postgres',true);
 INSERT INTO _mika_checks VALUES('suggest_limit_13_rejected',accepted=false);
 PERFORM set_config('role','authenticated',true);
 accepted:=public.mika_consume_ai_quota('transcribe');
 PERFORM set_config('role','postgres',true);
 INSERT INTO _mika_checks VALUES('transcription_unaffected_by_suggest_exhaustion',accepted=true);
 SELECT requests INTO n FROM mika_internal.ai_quota
 WHERE user_id=u AND action='transcribe';
 INSERT INTO _mika_checks VALUES('transcription_counter_independent',n=1);
END $$;
SELECT * FROM _mika_checks;
ROLLBACK;
