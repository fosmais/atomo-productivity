-- Staging-only Finance soft-delete; DO NOT apply to production without release approval.
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
