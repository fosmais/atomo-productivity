-- Regression: stale archive/restore must not overwrite newer changes.
-- Preview only. Transaction rolls back all test data.
BEGIN;
DO $$
DECLARE
  v_user uuid;
  v_id uuid := gen_random_uuid();
  v_old timestamptz;
  v_count integer;
  v_status text;
BEGIN
  SELECT id INTO v_user FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'No test user'; END IF;
  INSERT INTO public.mika_ideas(id,user_id,content,source,status)
  VALUES(v_id,v_user,'idea','text','captured');
  SELECT updated_at INTO v_old FROM public.mika_ideas WHERE id=v_id;

  UPDATE public.mika_ideas SET content='newer edit', updated_at=v_old+interval '2 seconds'
  WHERE id=v_id AND user_id=v_user AND updated_at=v_old;
  IF NOT FOUND THEN RAISE EXCEPTION 'First edit failed'; END IF;

  UPDATE public.mika_ideas SET status='archived',updated_at=v_old+interval '3 seconds'
  WHERE id=v_id AND user_id=v_user AND updated_at=v_old;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>0 THEN RAISE EXCEPTION 'Stale archive was accepted'; END IF;
  SELECT status INTO v_status FROM public.mika_ideas WHERE id=v_id;
  IF v_status<>'captured' THEN RAISE EXCEPTION 'Stale archive changed status'; END IF;

  UPDATE public.mika_ideas SET status='archived',updated_at=v_old+interval '4 seconds'
  WHERE id=v_id AND user_id=v_user AND updated_at=v_old+interval '2 seconds';
  IF NOT FOUND THEN RAISE EXCEPTION 'Fresh archive failed'; END IF;

  UPDATE public.mika_ideas SET status='captured',updated_at=v_old+interval '5 seconds'
  WHERE id=v_id AND user_id=v_user AND updated_at=v_old+interval '2 seconds';
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>0 THEN RAISE EXCEPTION 'Stale restore was accepted'; END IF;
  SELECT status INTO v_status FROM public.mika_ideas WHERE id=v_id;
  IF v_status<>'archived' THEN RAISE EXCEPTION 'Stale restore changed status'; END IF;

  RAISE NOTICE 'PASS: stale archive and restore blocked';
END $$;
ROLLBACK;
