-- STAGING ONLY: reconstruct remaining Finance tables from read-only production inventory.
CREATE TABLE public.myryra_finance_expected_income (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),amount_cents bigint NOT NULL CHECK (amount_cents>0),
 due_date date NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX myryra_finance_expected_income_user_date ON public.myryra_finance_expected_income(user_id,due_date);
CREATE TABLE public.myryra_finance_alert_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 days integer NOT NULL DEFAULT 7 CHECK(days IN(3,7,14)),
 subscriptions boolean NOT NULL DEFAULT true,expenses boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(),email_enabled boolean NOT NULL DEFAULT false,
 push_enabled boolean NOT NULL DEFAULT false,daily_digest_enabled boolean NOT NULL DEFAULT false);
CREATE TABLE public.myryra_finance_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 alert_key text NOT NULL,title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 180),
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 1000),due_date date,
 read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,alert_key));
CREATE INDEX myryra_finance_notifications_user_created ON public.myryra_finance_notifications(user_id,created_at DESC);
CREATE TABLE public.myryra_finance_delivery_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 notification_id uuid NOT NULL REFERENCES public.myryra_finance_notifications(id) ON DELETE CASCADE,
 channel text NOT NULL CHECK(channel IN('email','push')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','processing','sent','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0 CONSTRAINT finance_delivery_attempts_nonnegative CHECK(attempts>=0),
 created_at timestamptz NOT NULL DEFAULT now(),next_attempt_at timestamptz,last_error text,sent_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(notification_id,channel));
CREATE INDEX finance_delivery_queue_ready_idx ON public.myryra_finance_delivery_log(next_attempt_at,created_at)
 WHERE status IN('pending','failed') AND attempts<3;
ALTER TABLE public.myryra_finance_expected_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.myryra_finance_alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.myryra_finance_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.myryra_finance_delivery_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own expected income" ON public.myryra_finance_expected_income FOR SELECT TO authenticated USING((SELECT auth.uid())=user_id);
CREATE POLICY "Users insert own expected income" ON public.myryra_finance_expected_income FOR INSERT TO authenticated WITH CHECK((SELECT auth.uid())=user_id);
CREATE POLICY "Users delete own expected income" ON public.myryra_finance_expected_income FOR DELETE TO authenticated USING((SELECT auth.uid())=user_id);
CREATE POLICY finance_alert_prefs_select_own ON public.myryra_finance_alert_preferences FOR SELECT TO authenticated USING((SELECT auth.uid())=user_id);
CREATE POLICY finance_alert_prefs_insert_own ON public.myryra_finance_alert_preferences FOR INSERT TO authenticated WITH CHECK((SELECT auth.uid())=user_id);
CREATE POLICY finance_alert_prefs_update_own ON public.myryra_finance_alert_preferences FOR UPDATE TO authenticated USING((SELECT auth.uid())=user_id) WITH CHECK((SELECT auth.uid())=user_id);
CREATE POLICY finance_notifications_read_own ON public.myryra_finance_notifications FOR SELECT TO authenticated USING((SELECT auth.uid())=user_id);
CREATE POLICY finance_notifications_insert_own ON public.myryra_finance_notifications FOR INSERT TO authenticated WITH CHECK((SELECT auth.uid())=user_id);
CREATE POLICY finance_notifications_update_own ON public.myryra_finance_notifications FOR UPDATE TO authenticated USING((SELECT auth.uid())=user_id) WITH CHECK((SELECT auth.uid())=user_id);
CREATE POLICY finance_delivery_log_own ON public.myryra_finance_delivery_log FOR SELECT TO authenticated USING((SELECT auth.uid())=user_id);
GRANT SELECT,INSERT,DELETE ON public.myryra_finance_expected_income TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.myryra_finance_alert_preferences TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.myryra_finance_notifications TO authenticated;
GRANT SELECT ON public.myryra_finance_delivery_log TO authenticated;
