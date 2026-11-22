-- MIKA Insights: teste transacional de controle de acesso e cotas (homologação).
-- Execute somente no Supabase de homologação. Nenhuma alteração é persistida.
-- Não simula login real nem substitui testes E2E com hCaptcha.
BEGIN;
DO $$
DECLARE
  v_user uuid;
  v_allowed boolean;
BEGIN
  IF has_function_privilege('anon', 'public.mika_consume_ai_quota(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can execute quota RPC';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.mika_consume_ai_quota(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated cannot execute quota RPC';
  END IF;
  SELECT id INTO v_user FROM auth.users LIMIT 1;
  IF v_user IS NULL THEN
    RAISE NOTICE 'SKIP: no existing auth user; RPC identity checks not exercised';
    RETURN;
  END IF;
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  SET LOCAL ROLE authenticated;
  SELECT public.mika_consume_ai_quota('invalid') INTO v_allowed;
  IF v_allowed IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: unknown action accepted';
  END IF;
  RAISE NOTICE 'PASS: invalid quota action rejected';
END $$;
ROLLBACK;
