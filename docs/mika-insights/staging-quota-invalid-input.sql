-- MIKA Insights: invalid quota action and missing identity regression.
-- STAGING ONLY. All mutations are rolled back.
BEGIN;
CREATE TEMP TABLE _checks(test text,passed boolean) ON COMMIT DROP;
DO $$
DECLARE u uuid; n integer; ok boolean;
BEGIN
 SELECT id INTO u FROM auth.users ORDER BY id LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'staging user required'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('role','authenticated',true);
 ok:=public.mika_consume_ai_quota('suggest');
 PERFORM set_config('role','postgres',true);
 INSERT INTO _checks VALUES('missing_identity_rejected',ok=false);
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM set_config('role','authenticated',true);
 ok:=public.mika_consume_ai_quota('invalid_action');
 PERFORM set_config('role','postgres',true);
 INSERT INTO _checks VALUES('invalid_action_rejected',ok=false);
 SELECT count(*) INTO n FROM mika_internal.ai_quota
 WHERE user_id=u AND action='invalid_action';
 INSERT INTO _checks VALUES('invalid_action_not_persisted',n=0);
END $$;
SELECT * FROM _checks;
ROLLBACK;
