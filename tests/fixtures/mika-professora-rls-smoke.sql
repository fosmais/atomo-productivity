-- MIKA teacher RLS smoke test. Run ONLY on an empty, disposable Supabase test database.
-- Rolls back all users, sessions, and policy changes. Do not run in production.
BEGIN;
ALTER TABLE public.mika_teacher_sessions ALTER COLUMN journey_id DROP NOT NULL;
DROP POLICY IF EXISTS "teacher sessions insert own journey" ON public.mika_teacher_sessions;
CREATE POLICY "teacher sessions insert own or free lesson" ON public.mika_teacher_sessions FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid())=owner_id AND (journey_id IS NULL OR EXISTS (
 SELECT 1 FROM public.myryra_journeys j WHERE j.id=journey_id
 AND j.owner_id=(SELECT auth.uid()) AND j.status='active')));
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at) VALUES
('00000000-0000-4000-8000-000000000101','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mika-fixture-101@example.invalid','',now(),now()),
('00000000-0000-4000-8000-000000000102','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mika-fixture-102@example.invalid','',now(),now());
DO $test$
DECLARE a uuid := '00000000-0000-4000-8000-000000000101'; b uuid := '00000000-0000-4000-8000-000000000102'; sid uuid; n integer; denied boolean;
BEGIN
 PERFORM set_config('role','authenticated',true);
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 INSERT INTO public.mika_teacher_sessions(owner_id,journey_id,topic) VALUES(a,NULL,'Italiano') RETURNING id INTO sid;
 SELECT count(*) INTO n FROM public.mika_teacher_sessions WHERE id=sid;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL owner cannot see own session'; END IF;
 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 SELECT count(*) INTO n FROM public.mika_teacher_sessions WHERE id=sid;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL cross-user SELECT leaked'; END IF;
 denied:=false;
 BEGIN
  INSERT INTO public.mika_teacher_sessions(owner_id,journey_id,topic) VALUES(a,NULL,'Spoofed');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL cross-user INSERT allowed'; END IF;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 denied:=false;
 BEGIN
  INSERT INTO public.mika_teacher_messages(session_id,owner_id,role,content) VALUES(sid,a,'assistant','Spoof');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL client message write allowed'; END IF;
 RAISE NOTICE 'PASS all MIKA teacher RLS assertions';
END $test$;
ROLLBACK;
