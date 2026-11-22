-- MIKA Insights: two-user UPDATE and DELETE RLS regression.
-- STAGING ONLY; uses existing users and rolls back every change.
BEGIN;
CREATE TEMP TABLE _results (test text, passed boolean) ON COMMIT DROP;
DO $$
DECLARE u1 uuid; u2 uuid; idea uuid; n integer;
BEGIN
 SELECT id INTO u1 FROM auth.users ORDER BY id LIMIT 1;
 SELECT id INTO u2 FROM auth.users ORDER BY id OFFSET 1 LIMIT 1;
 IF u1 IS NULL OR u2 IS NULL THEN RAISE EXCEPTION 'Two users required'; END IF;
 INSERT INTO public.mika_ideas(user_id,content,source)
 VALUES(u1,'temporary cross-user test','text') RETURNING id INTO idea;
 PERFORM set_config('request.jwt.claim.sub',u2::text,true);
 PERFORM set_config('role','authenticated',true);
 UPDATE public.mika_ideas SET content='unauthorized modification' WHERE id=idea;
 GET DIAGNOSTICS n=ROW_COUNT;
 PERFORM set_config('role','postgres',true);
 INSERT INTO _results VALUES('other_user_update_blocked',n=0);
 PERFORM set_config('role','authenticated',true);
 DELETE FROM public.mika_ideas WHERE id=idea;
 GET DIAGNOSTICS n=ROW_COUNT;
 PERFORM set_config('role','postgres',true);
 INSERT INTO _results VALUES('other_user_delete_blocked',n=0);
 PERFORM set_config('request.jwt.claim.sub',u1::text,true);
 PERFORM set_config('role','authenticated',true);
 UPDATE public.mika_ideas SET content='owner update' WHERE id=idea;
 GET DIAGNOSTICS n=ROW_COUNT;
 PERFORM set_config('role','postgres',true);
 INSERT INTO _results VALUES('owner_update_allowed',n=1);
 PERFORM set_config('role','authenticated',true);
 DELETE FROM public.mika_ideas WHERE id=idea;
 GET DIAGNOSTICS n=ROW_COUNT;
 PERFORM set_config('role','postgres',true);
 INSERT INTO _results VALUES('owner_delete_allowed',n=1);
END $$;
SELECT * FROM _results;
ROLLBACK;
