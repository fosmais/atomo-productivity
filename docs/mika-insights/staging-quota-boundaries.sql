-- MIKA Insights: quota boundary regression (staging only).
-- Uses an existing staging auth user. All writes are rolled back.
BEGIN;
CREATE TEMP TABLE _quota_results(test text, passed boolean) ON COMMIT DROP;
DO $$
DECLARE u uuid; i integer; ok boolean;
BEGIN
 SELECT id INTO u FROM auth.users ORDER BY id LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'No staging test user'; END IF;
 PERFORM set_config('request.jwt.claim.sub', u::text, true);
 PERFORM set_config('role', 'authenticated', true);
 FOR i IN 1..12 LOOP
   ok := public.mika_consume_ai_quota('suggest');
   IF NOT ok THEN RAISE EXCEPTION 'suggest rejected at %', i; END IF;
 END LOOP;
 ok := public.mika_consume_ai_quota('suggest');
 PERFORM set_config('role', 'postgres', true);
 INSERT INTO _quota_results VALUES('suggest_12_allowed_13_denied', ok = false);
 PERFORM set_config('role', 'authenticated', true);
 FOR i IN 1..20 LOOP
   ok := public.mika_consume_ai_quota('transcribe');
   IF NOT ok THEN RAISE EXCEPTION 'transcribe rejected at %', i; END IF;
 END LOOP;
 ok := public.mika_consume_ai_quota('transcribe');
 PERFORM set_config('role', 'postgres', true);
 INSERT INTO _quota_results VALUES('transcribe_20_allowed_21_denied', ok = false);
END $$;
SELECT * FROM _quota_results;
ROLLBACK;
