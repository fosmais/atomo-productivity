-- Staging-only hardening: TRUNCATE bypasses row-level security.
-- Also remove unnecessary REFERENCES and TRIGGER from client roles.
-- Preserve application SELECT/INSERT/UPDATE/DELETE grants already defined.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON
 public.myryra_finance_alert_preferences,
 public.myryra_finance_balances,
 public.myryra_finance_delivery_log,
 public.myryra_finance_entries,
 public.myryra_finance_expected_income,
 public.myryra_finance_goals,
 public.myryra_finance_notifications,
 public.myryra_finance_planned_expenses,
 public.myryra_finance_subscriptions
 FROM anon, authenticated, PUBLIC;
