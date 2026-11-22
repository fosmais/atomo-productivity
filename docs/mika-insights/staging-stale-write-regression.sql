-- MIKA Insights: stale-write optimistic concurrency regression.
-- STAGING ONLY. All mutations are rolled back.
BEGIN;
CREATE TEMP TABLE _mika_result(test text,passed boolean) ON COMMIT DROP;
DO $$
DECLARE u uuid; idea uuid; old_ts timestamptz; n integer;
BEGIN
 SELECT id INTO u FROM auth.users ORDER BY id LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'Staging user required'; END IF;
 INSERT INTO public.mika_ideas(user_id,content,source)
 VALUES(u,'temporary concurrency regression','text')
 RETURNING id,updated_at INTO idea,old_ts;
 UPDATE public.mika_ideas
 SET content='newer revision',updated_at=old_ts+interval '1 second'
 WHERE id=idea;
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM set_config('role','authenticated',true);
 UPDATE public.mika_ideas SET content='stale overwrite'
 WHERE id=idea AND user_id=u AND updated_at=old_ts;
 GET DIAGNOSTICS n=ROW_COUNT;
 PERFORM set_config('role','postgres',true);
 INSERT INTO _mika_result VALUES('stale_update_rejected',n=0);
 PERFORM set_config('role','authenticated',true);
 DELETE FROM public.mika_ideas
 WHERE id=idea AND user_id=u AND updated_at=old_ts;
 GET DIAGNOSTICS n=ROW_COUNT;
 PERFORM set_config('role','postgres',true);
 INSERT INTO _mika_result VALUES('stale_delete_rejected',n=0);
END $$;
SELECT * FROM _mika_result;
ROLLBACK;
