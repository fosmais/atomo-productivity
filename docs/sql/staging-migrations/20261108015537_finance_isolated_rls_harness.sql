-- STAGING ONLY: initial isolated Finance harness (reconstructed from verified schema).
-- Subsequent migrations add soft delete, parity constraints, indexes and policy renames.
CREATE TABLE public.myryra_finance_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 description text NOT NULL,
 amount_cents bigint NOT NULL CHECK (amount_cents > 0),
 kind text NOT NULL CHECK (kind IN ('income','expense')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.myryra_finance_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 title text NOT NULL,
 amount_cents bigint NOT NULL CHECK (amount_cents > 0),
 billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
 next_due_date date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.myryra_finance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.myryra_finance_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_entries_select_own ON public.myryra_finance_entries FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY finance_entries_insert_own ON public.myryra_finance_entries FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=user_id);
CREATE POLICY finance_entries_delete_own ON public.myryra_finance_entries FOR DELETE TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY finance_subscriptions_select_own ON public.myryra_finance_subscriptions FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY finance_subscriptions_insert_own ON public.myryra_finance_subscriptions FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=user_id);
CREATE POLICY finance_subscriptions_delete_own ON public.myryra_finance_subscriptions FOR DELETE TO authenticated USING ((SELECT auth.uid())=user_id);
GRANT SELECT,INSERT,DELETE ON public.myryra_finance_entries,public.myryra_finance_subscriptions TO authenticated;
-- UPDATE grant is required by the subsequent soft-delete migration.
GRANT UPDATE ON public.myryra_finance_entries,public.myryra_finance_subscriptions TO authenticated;
