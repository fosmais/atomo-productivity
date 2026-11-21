-- MYRYRA MVP2 Finance: remaining four tables, two-identity RLS regression.
-- Execute ONLY against isolated Supabase staging. All fixtures are rolled back.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role) VALUES
('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
INSERT INTO public.myryra_finance_expected_income(id,user_id,title,amount_cents,due_date)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Expected income',10000,CURRENT_DATE+7);
INSERT INTO public.myryra_finance_alert_preferences(user_id)
VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO public.myryra_finance_notifications(id,user_id,alert_key,title,body)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','regression-key','Notification','Body');
DO $$ DECLARE n integer; BEGIN
 UPDATE public.myryra_finance_alert_preferences SET days=14 WHERE user_id='11111111-1111-4111-8111-111111111111';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Owner preferences UPDATE'; END IF;
 UPDATE public.myryra_finance_notifications SET read_at=now() WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Owner notification UPDATE'; END IF;
END $$;
RESET ROLE;
-- Simulates a trusted delivery worker; authenticated users have no INSERT grant on delivery log.
INSERT INTO public.myryra_finance_delivery_log(id,user_id,notification_id,channel)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','email');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.myryra_finance_expected_income;
 IF n<>0 THEN RAISE EXCEPTION 'Cross-user income SELECT'; END IF;
 SELECT count(*) INTO n FROM public.myryra_finance_alert_preferences;
 IF n<>0 THEN RAISE EXCEPTION 'Cross-user preferences SELECT'; END IF;
 SELECT count(*) INTO n FROM public.myryra_finance_notifications;
 IF n<>0 THEN RAISE EXCEPTION 'Cross-user notifications SELECT'; END IF;
 SELECT count(*) INTO n FROM public.myryra_finance_delivery_log;
 IF n<>0 THEN RAISE EXCEPTION 'Cross-user delivery SELECT'; END IF;
 DELETE FROM public.myryra_finance_expected_income WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Cross-user income DELETE'; END IF;
 UPDATE public.myryra_finance_alert_preferences SET days=3 WHERE user_id='11111111-1111-4111-8111-111111111111';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Cross-user preferences UPDATE'; END IF;
 UPDATE public.myryra_finance_notifications SET read_at=now() WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Cross-user notifications UPDATE'; END IF;
END $$;
ROLLBACK;
