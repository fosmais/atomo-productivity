-- Finance staging regression, transactional: no persisted fixtures.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role) VALUES
('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
INSERT INTO public.myryra_finance_entries(id,user_id,description,amount_cents,kind)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','Finance regression',12345,'income');
INSERT INTO public.myryra_finance_subscriptions(id,user_id,title,amount_cents,billing_cycle,next_due_date)
VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','Subscription regression',1234,'monthly',CURRENT_DATE+10);
DO $$
DECLARE n integer;
BEGIN
 UPDATE public.myryra_finance_entries SET description='Edited' WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Owner entry edit'; END IF;
 UPDATE public.myryra_finance_subscriptions SET title='Edited' WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Owner subscription edit'; END IF;
 UPDATE public.myryra_finance_entries SET deleted_at=now() WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Owner entry trash'; END IF;
 UPDATE public.myryra_finance_subscriptions SET deleted_at=now() WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Owner subscription trash'; END IF;
 UPDATE public.myryra_finance_entries SET deleted_at=null WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Owner entry restore'; END IF;
 UPDATE public.myryra_finance_subscriptions SET deleted_at=null WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Owner subscription restore'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.myryra_finance_entries WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 IF n<>0 THEN RAISE EXCEPTION 'Cross-user entry SELECT'; END IF;
 SELECT count(*) INTO n FROM public.myryra_finance_subscriptions WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 IF n<>0 THEN RAISE EXCEPTION 'Cross-user subscription SELECT'; END IF;
 UPDATE public.myryra_finance_entries SET description='Intrusion' WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Cross-user entry UPDATE'; END IF;
 UPDATE public.myryra_finance_subscriptions SET title='Intrusion' WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Cross-user subscription UPDATE'; END IF;
END $$;
ROLLBACK;