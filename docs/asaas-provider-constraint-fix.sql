-- MYRYRA MVP1: allow Asaas in existing billing provider constraints.
-- Review and apply in an isolated sandbox before production.
-- No billing charges, subscriptions or entitlements are created by this change.
begin;
alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_provider_check;
alter table public.billing_subscriptions
  add constraint billing_subscriptions_provider_check
  check (provider in ('mercado_pago','stripe','asaas'));
alter table public.billing_webhook_events
  drop constraint if exists billing_webhook_events_provider_check;
alter table public.billing_webhook_events
  add constraint billing_webhook_events_provider_check
  check (provider in ('mercado_pago','stripe','asaas'));
commit;
