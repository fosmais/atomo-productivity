-- Regression: stale delete must preserve newer content; current-version delete succeeds.
-- Preview only. Entire transaction is rolled back.
BEGIN;
DO $$
DECLARE
  v_user uuid;
  v_id uuid := gen_random_uuid();
  v_old timestamptz;
  v_count integer;
  v_content text;
BEGIN
  SELECT id INTO v_user FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'No test user'; END IF;
  INSERT INTO public.mika_ideas(id,user_id,content,source,status)
  VALUES(v_id,v_user,'original','text','captured');
  SELECT updated_at INTO v_old FROM public.mika_ideas WHERE id=v_id;

  UPDATE public.mika_ideas SET content='newer',updated_at=v_old+interval '2 seconds'
  WHERE id=v_id AND user_id=v_user AND updated_at=v_old;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fresh update failed'; END IF;

  DELETE FROM public.mika_ideas WHERE id=v_id AND user_id=v_user AND updated_at=v_old;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>0 THEN RAISE EXCEPTION 'Stale delete succeeded'; END IF;
  SELECT content INTO v_content FROM public.mika_ideas WHERE id=v_id;
  IF v_content<>'newer' THEN RAISE EXCEPTION 'Latest content not preserved'; END IF;

  DELETE FROM public.mika_ideas WHERE id=v_id AND user_id=v_user
  AND updated_at=v_old+interval '2 seconds';
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 THEN RAISE EXCEPTION 'Fresh delete failed'; END IF;
  RAISE NOTICE 'PASS: stale delete blocked, fresh delete allowed';
END $$;
ROLLBACK;
