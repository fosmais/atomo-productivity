-- MYRYRA MVP1 emergency rollback
-- The restrictive policies below reference auth.mfa_factors directly.
-- The authenticated role cannot SELECT auth.mfa_factors, so user queries fail
-- with PostgreSQL error 42501 (permission denied for table mfa_factors).
-- Restore the previously deployed ownership-based RLS policies.
-- Run in Supabase SQL Editor with project-owner privileges.
BEGIN;
DROP POLICY IF EXISTS mvp1_mfa_verified_session ON public.plans;
DROP POLICY IF EXISTS mvp1_mfa_verified_session ON public.tasks;
DROP POLICY IF EXISTS mvp1_mfa_verified_session ON public.events;
DROP POLICY IF EXISTS mvp1_mfa_verified_session ON public.favorites;
DROP POLICY IF EXISTS mvp1_mfa_verified_session ON public.myka_conversations;
DROP POLICY IF EXISTS mvp1_mfa_verified_session ON public.myka_messages;
COMMIT;

-- Expected: 0 rows.
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname = 'mvp1_mfa_verified_session';
