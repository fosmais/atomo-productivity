-- MIKA Insights: INSERT and ownership reassignment RLS checks.
-- STAGING ONLY. All mutations are rolled back.
BEGIN;
CREATE TEMP TABLE _checks(test text, passed boolean) ON COMMIT DROP;
DO $$
DECLARE a uuid; b uuid; idea uuid; rejected boolean;
BEGIN
 SELECT id INTO a FROM auth.users ORDER BY id LIMIT 1;
 SELECT id INTO b FROM auth.users ORDER BY id OFFSET 1 LIMIT 1;
 IF a IS NULL OR b IS NULL THEN RAISE EXCEPTION 'two staging users required'; END IF;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('role','authenticated',true);
 INSERT INTO public.mika_ideas(user_id,content)
 VALUES(a,'temporary owner check') RETURNING id INTO idea;
 PERFORM set_config('role','postgres',true);
 INSERT INTO _checks VALUES('owner_insert_allowed',idea IS NOT NULL);
 PERFORM set_config('role','authenticated',true);
 rejected:=false;
 BEGIN
   INSERT INTO public.mika_ideas(user_id,content)
   VALUES(b,'cross-owner insert');
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
 END;
 PERFORM set_config('role','postgres',true);
 INSERT INTO _checks VALUES('cross_owner_insert_denied',rejected);
 PERFORM set_config('role','authenticated',true);
 rejected:=false;
 BEGIN
   UPDATE public.mika_ideas SET user_id=b WHERE id=idea;
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
 END;
 PERFORM set_config('role','postgres',true);
 INSERT INTO _checks VALUES('owner_reassignment_denied',rejected);
END $$;
SELECT * FROM _checks;
ROLLBACK;
