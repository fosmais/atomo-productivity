-- MIKA Insights | staging-only, rollback-only access-control smoke test.
-- Execute no SQL Editor do projeto de HOMOLOGACAO (nunca Production).
-- Verifica usuario autenticado sem JWT; nao substitui E2E/hCaptcha.
BEGIN;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: unexpected user identity';
  END IF;
  IF public.mika_consume_ai_quota('invalid') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: invalid quota action accepted';
  END IF;
  IF public.mika_consume_ai_quota('suggest') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: quota consumed without user identity';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mika_ideas) THEN
    RAISE EXCEPTION 'FAIL: ideas visible without user identity';
  END IF;
  RAISE NOTICE 'PASS: identity, invalid action, quota and idea visibility';
END $$;
ROLLBACK;

-- Permissoes verificadas separadamente, sem assumir usuario de teste existente:
SELECT
  NOT has_function_privilege('anon','public.mika_consume_ai_quota(text)','EXECUTE') AS anon_quota_denied,
  has_function_privilege('authenticated','public.mika_consume_ai_quota(text)','EXECUTE') AS authenticated_quota_granted,
  NOT has_table_privilege('anon','public.mika_ideas','SELECT') AS anon_ideas_denied;
