-- MYRYRA MVP2: add missing owner-only UPDATE policies for Finance.
-- Prepared for review; do not run against production before authenticated E2E tests.
-- PostgreSQL RLS policies are permissive by default; existing SELECT/INSERT/DELETE remain unchanged.
BEGIN;
CREATE POLICY finance_entries_update_own
ON public.myryra_finance_entries FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY finance_subscriptions_update_own
ON public.myryra_finance_subscriptions FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
COMMIT;
