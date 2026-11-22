-- MIKA Insights: rolling one-hour quota reset regression.
-- STAGING ONLY. Uses an existing user; transaction is rolled back.
BEGIN;
CREATE TEMP TABLE _result(test text, passed boolean) ON COMMIT DROP;
DO $$
DECLARE u uuid; ok boolean;
BEGIN
 SELECT id INTO u FROM auth.users ORDER BY id LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'No staging user available'; END IF;
 PERFORM set_config('request.jwt.claim.sub', u::text, true);
 PERFORM set_config('role', 'authenticated', true);
 ok := public.mika_consume_ai_quota('suggest');
 PERFORM set_config('role', 'postgres', true);
 INSERT INTO _result VALUES('initial_allowed', ok);
 UPDATE mika_internal.ai_quota
 SET window_start = now() - interval '61 minutes'
 WHERE user_id = u AND action = 'suggest';
 PERFORM set_config('role', 'authenticated', true);
 ok := public.mika_consume_ai_quota('suggest');
 PERFORM set_config('role', 'postgres', true);
 INSERT INTO _result VALUES('window_reset_allowed', ok);
 INSERT INTO _result
 SELECT 'counter_reset_to_one', requests = 1
 FROM mika_internal.ai_quota WHERE user_id = u AND action = 'suggest';
END $$;
SELECT * FROM _result;
ROLLBACK;
