-- MYRYRA MVP2: staging only. Transactional two-user support RLS probe.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at) VALUES
('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-test-a@example.invalid','',now(),now()),
('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-test-b@example.invalid','',now(),now());
INSERT INTO public.support_tickets(user_id,subject,message) VALUES
('11111111-1111-4111-8111-111111111111','RLS fixture A','Mensagem de teste de isolamento do usuário A'),
('22222222-2222-4222-8222-222222222222','RLS fixture B','Mensagem de teste de isolamento do usuário B');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
IF (SELECT count(*) FROM public.support_tickets) <> 1 OR
EXISTS(SELECT 1 FROM public.support_tickets WHERE user_id='22222222-2222-4222-8222-222222222222')
THEN RAISE EXCEPTION 'RLS isolation failed for user A'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$ BEGIN
IF (SELECT count(*) FROM public.support_tickets) <> 1 OR
EXISTS(SELECT 1 FROM public.support_tickets WHERE user_id='11111111-1111-4111-8111-111111111111')
THEN RAISE EXCEPTION 'RLS isolation failed for user B'; END IF;
END $$;
SELECT auth.uid() AS tested_user, count(*) AS visible_tickets FROM public.support_tickets;
ROLLBACK;
