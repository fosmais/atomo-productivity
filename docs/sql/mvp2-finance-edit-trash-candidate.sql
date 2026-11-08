-- MYRYRA MVP2 Finance: reviewed migration candidate, NOT applied to production.
-- Apply as a versioned migration after testing on a staging database.
BEGIN;

ALTER TABLE public.myryra_finance_entries
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.myryra_finance_subscriptions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS myryra_finance_subscriptions_user_active_idx
  ON public.myryra_finance_subscriptions (user_id, next_due_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS myryra_finance_entries_user_active_idx
  ON public.myryra_finance_entries (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

DROP POLICY IF EXISTS finance_entries_update_own ON public.myryra_finance_entries;
CREATE POLICY finance_entries_update_own
  ON public.myryra_finance_entries FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS finance_subscriptions_update_own ON public.myryra_finance_subscriptions;
CREATE POLICY finance_subscriptions_update_own
  ON public.myryra_finance_subscriptions FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

COMMIT;

-- Before enabling NEXT_PUBLIC_MYRYRA_FINANCE_TRASH_ENABLED:
-- 1. Verify column, RLS and existing data in staging.
-- 2. Test update/delete/restore under two authenticated identities.
-- 3. Verify the feature flag is off until migration is applied in production.
