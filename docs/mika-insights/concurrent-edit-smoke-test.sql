-- MIKA Insights: regression test for optimistic concurrency on idea edits.
-- Run only in Supabase Preview. All test data is rolled back.
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
  IF v_user IS NULL THEN RAISE EXCEPTION 'No test user available'; END IF;

  INSERT INTO public.mika_ideas (id, user_id, content, source, status)
  VALUES (v_id, v_user, 'original', 'text', 'captured');
  SELECT updated_at INTO v_old FROM public.mika_ideas WHERE id = v_id;

  -- Session A saves the first change.
  UPDATE public.mika_ideas
  SET content = 'session A', updated_at = v_old + interval '2 seconds'
  WHERE id = v_id AND user_id = v_user AND updated_at = v_old;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session A update failed'; END IF;

  -- Session B attempts a stale update based on the same original timestamp.
  UPDATE public.mika_ideas
  SET content = 'session B', updated_at = v_old + interval '3 seconds'
  WHERE id = v_id AND user_id = v_user AND updated_at = v_old;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Stale edit overwrote newer content'; END IF;

  SELECT content INTO v_content FROM public.mika_ideas WHERE id = v_id;
  IF v_content <> 'session A' THEN RAISE EXCEPTION 'Newest content was lost'; END IF;
  RAISE NOTICE 'PASS: stale edit blocked and latest content preserved';
END $$;
ROLLBACK;
