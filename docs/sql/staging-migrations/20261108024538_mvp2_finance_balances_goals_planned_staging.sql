-- STAGING ONLY: reconstruct three Finance tables from read-only production inventory.
CREATE TABLE IF NOT EXISTS public.myryra_finance_balances (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 opening_balance_cents bigint NOT NULL DEFAULT 0 CHECK (opening_balance_cents BETWEEN -100000000000 AND 100000000000),
 updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.myryra_finance_goals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
 target_cents bigint NOT NULL CHECK (target_cents BETWEEN 1 AND 100000000000),
 saved_cents bigint NOT NULL DEFAULT 0 CHECK (saved_cents BETWEEN 0 AND 100000000000),
 created_at timestamptz NOT NULL DEFAULT now(),
 priority text NOT NULL DEFAULT 'important' CHECK (priority IN ('essential','important','optional')));
CREATE TABLE IF NOT EXISTS public.myryra_finance_planned_expenses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
 amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 1 AND 100000000000),
 due_date date NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),paid_at timestamptz);
CREATE INDEX IF NOT EXISTS myryra_finance_goals_user_idx ON public.myryra_finance_goals(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS myryra_finance_planned_user_idx ON public.myryra_finance_planned_expenses(user_id,due_date);
ALTER TABLE public.myryra_finance_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.myryra_finance_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.myryra_finance_planned_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_balance_select_own ON public.myryra_finance_balances FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY finance_balance_insert_own ON public.myryra_finance_balances FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=user_id);
CREATE POLICY finance_balance_update_own ON public.myryra_finance_balances FOR UPDATE TO authenticated USING ((SELECT auth.uid())=user_id) WITH CHECK ((SELECT auth.uid())=user_id);
CREATE POLICY finance_goals_select ON public.myryra_finance_goals FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY finance_goals_insert ON public.myryra_finance_goals FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=user_id);
CREATE POLICY finance_goals_update ON public.myryra_finance_goals FOR UPDATE TO authenticated USING ((SELECT auth.uid())=user_id) WITH CHECK ((SELECT auth.uid())=user_id);
CREATE POLICY finance_goals_delete ON public.myryra_finance_goals FOR DELETE TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY finance_planned_select ON public.myryra_finance_planned_expenses FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY finance_planned_insert ON public.myryra_finance_planned_expenses FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=user_id);
CREATE POLICY finance_planned_delete ON public.myryra_finance_planned_expenses FOR DELETE TO authenticated USING ((SELECT auth.uid())=user_id);
GRANT SELECT,INSERT,UPDATE ON public.myryra_finance_balances TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.myryra_finance_goals TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.myryra_finance_planned_expenses TO authenticated;
