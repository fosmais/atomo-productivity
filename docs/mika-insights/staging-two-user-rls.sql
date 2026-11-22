-- MIKA Insights: two-user RLS SELECT isolation test.
-- STAGING ONLY. Uses existing auth users, creates a temporary idea and rolls back.
BEGIN;
CREATE TEMP TABLE _mika_rls_test_result (
  owner_can_see boolean,
  other_cannot_see boolean
) ON COMMIT DROP;
DO $$
DECLARE
  u1 uuid;
  u2 uuid;
  idea uuid;
  c1 integer;
  c2 integer;
BEGIN
  SELECT id INTO u1 FROM auth.users ORDER BY id LIMIT 1;
  SELECT id INTO u2 FROM auth.users ORDER BY id OFFSET 1 LIMIT 1;
  IF u1 IS NULL OR u2 IS NULL THEN
    RAISE EXCEPTION 'Two staging users required';
  END IF;
  INSERT INTO public.mika_ideas(user_id, content, source)
  VALUES(u1, 'MIKA temporary RLS regression', 'text')
  RETURNING id INTO idea;
  PERFORM set_config('request.jwt.claim.sub', u1::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO c1 FROM public.mika_ideas WHERE id = idea;
  PERFORM set_config('request.jwt.claim.sub', u2::text, true);
  SELECT count(*) INTO c2 FROM public.mika_ideas WHERE id = idea;
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO _mika_rls_test_result VALUES(c1 = 1, c2 = 0);
END $$;
SELECT * FROM _mika_rls_test_result;
ROLLBACK;
