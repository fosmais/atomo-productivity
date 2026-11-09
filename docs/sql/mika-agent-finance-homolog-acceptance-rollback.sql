-- MYRYRA MIKA: homologation-only, synthetic users, always rollback.
-- Run only on isolated finance homologation. Never run on production.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role) VALUES
('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
INSERT INTO public.plans(id,user_id,title) VALUES
('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','MIKA isolated acceptance test');
INSERT INTO public.mika_action_proposals(id,user_id,action_type,payload,created_at,expires_at) VALUES
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','create_task','{"type":"create_task","title":"Approved synthetic task","reason":"Homologation","due_at":null,"plan_id":"22222222-2222-4222-8222-222222222222"}',now(),now()+interval '15 minutes'),
('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','create_task','{"type":"create_task","title":"Rejected synthetic task","reason":"Homologation","due_at":null}',now(),now()+interval '15 minutes'),
('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','create_task','{"type":"create_task","title":"Expired synthetic task","reason":"Homologation","due_at":null}',now()-interval '20 minutes',now()-interval '1 minute');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $$ BEGIN
 BEGIN
  PERFORM * FROM public.mika_decide_proposal('33333333-3333-4333-8333-333333333333',true);
  RAISE EXCEPTION 'cross-user decision unexpectedly allowed';
 EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;
 END;
END $$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$
DECLARE v_first uuid; v_second uuid; v_status text; v_count int;
BEGIN
 PERFORM * FROM public.mika_decide_proposal('33333333-3333-4333-8333-333333333333',true);
 SELECT task_id INTO v_first FROM public.mika_execute_approved_task('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222');
 SELECT execution_status,task_id INTO v_status,v_second FROM public.mika_execute_approved_task('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222');
 IF v_first IS NULL OR v_first IS DISTINCT FROM v_second OR v_status <> 'already_executed' THEN RAISE EXCEPTION 'idempotency failed'; END IF;
 SELECT count(*) INTO v_count FROM public.tasks WHERE id=v_first;
 IF v_count <> 1 THEN RAISE EXCEPTION 'expected exactly one task'; END IF;
 SELECT decision_status INTO v_status FROM public.mika_decide_proposal('44444444-4444-4444-8444-444444444444',false);
 IF v_status <> 'rejected' THEN RAISE EXCEPTION 'rejection failed'; END IF;
 SELECT decision_status INTO v_status FROM public.mika_decide_proposal('55555555-5555-4555-8555-555555555555',true);
 IF v_status <> 'expired' THEN RAISE EXCEPTION 'expiry failed'; END IF;
END $$;
ROLLBACK;
