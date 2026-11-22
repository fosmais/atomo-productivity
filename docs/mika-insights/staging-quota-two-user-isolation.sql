-- MIKA Insights: quota isolation between two staging users.
-- STAGING ONLY. All changes rolled back.
BEGIN;
CREATE TEMP TABLE _results(test text, passed boolean) ON COMMIT DROP;
DO $$
DECLARE u1 uuid; u2 uuid; ok boolean; i integer;
BEGIN
 SELECT id INTO u1 FROM auth.users ORDER BY id LIMIT 1;
 SELECT id INTO u2 FROM auth.users ORDER BY id OFFSET 1 LIMIT 1;
 IF u1 IS NULL OR u2 IS NULL THEN RAISE EXCEPTION 'Two users required'; END IF;
 PERFORM set_config('request.jwt.claim.sub', u1::text, true);
 PERFORM set_config('role', 'authenticated', true);
 FOR i IN 1..12 LOOP
   IF NOT public.mika_consume_ai_quota('suggest') THEN
     RAISE EXCEPTION 'Unexpected denial for first user';
   END IF;
 END LOOP;
 ok := public.mika_consume_ai_quota('suggest');
 PERFORM set_config('role', 'postgres', true);
 INSERT INTO _results VALUES('user_one_limited', ok = false);
 PERFORM set_config('request.jwt.claim.sub', u2::text, true);
 PERFORM set_config('role', 'authenticated', true);
 ok := public.mika_consume_ai_quota('suggest');
 PERFORM set_config('role', 'postgres', true);
 INSERT INTO _results VALUES('user_two_unaffected', ok = true);
END $$;
SELECT * FROM _results;
ROLLBACK;
