-- Isolated Finance staging parity migration. Do not replay on production.
ALTER TABLE public.myryra_finance_entries DROP CONSTRAINT IF EXISTS myryra_finance_entries_amount_cents_check;
ALTER TABLE public.myryra_finance_entries ADD CONSTRAINT myryra_finance_entries_amount_cents_check CHECK (amount_cents BETWEEN 1 AND 100000000000);
ALTER TABLE public.myryra_finance_entries ADD CONSTRAINT myryra_finance_entries_description_check CHECK (char_length(btrim(description)) BETWEEN 1 AND 100);
ALTER TABLE public.myryra_finance_entries ADD CONSTRAINT myryra_finance_entries_user_id_fkey FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.myryra_finance_subscriptions DROP CONSTRAINT IF EXISTS myryra_finance_subscriptions_amount_cents_check;
ALTER TABLE public.myryra_finance_subscriptions ADD CONSTRAINT myryra_finance_subscriptions_amount_cents_check CHECK (amount_cents BETWEEN 1 AND 100000000000);
ALTER TABLE public.myryra_finance_subscriptions ADD CONSTRAINT myryra_finance_subscriptions_title_check CHECK (char_length(btrim(title)) BETWEEN 1 AND 100);
ALTER TABLE public.myryra_finance_subscriptions ADD CONSTRAINT myryra_finance_subscriptions_user_id_fkey FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.myryra_finance_notifications RENAME CONSTRAINT myryra_finance_notifications_body_check TO notification_body_limit;
ALTER TABLE public.myryra_finance_notifications RENAME CONSTRAINT myryra_finance_notifications_title_check TO notification_title_limit;
