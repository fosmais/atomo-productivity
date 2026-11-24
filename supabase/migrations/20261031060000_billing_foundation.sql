-- MYRYRA MVP1: billing state is server-managed only.
-- Apply after review; no payment provider is connected by this migration.
create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null default 'free' check (plan_id in ('free', 'pro', 'premium')),
  status text not null default 'inactive' check (status in ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  provider text check (provider in ('mercado_pago', 'stripe')),
  provider_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_paid_requires_provider check (plan_id = 'free' or provider is not null),
  constraint billing_provider_reference_unique unique (provider, provider_subscription_id)
);
create unique index if not exists billing_subscriptions_one_per_user on public.billing_subscriptions(user_id);
create index if not exists billing_subscriptions_provider_lookup on public.billing_subscriptions(provider, provider_subscription_id);
alter table public.billing_subscriptions enable row level security;
revoke all on public.billing_subscriptions from anon, authenticated;
grant select on public.billing_subscriptions to authenticated;
drop policy if exists billing_subscriptions_read_own on public.billing_subscriptions;
create policy billing_subscriptions_read_own on public.billing_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

-- Raw payment event IDs are unique to make webhook retries idempotent.
-- This table must never be exposed to authenticated/anon clients.
create table if not exists public.billing_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('mercado_pago', 'stripe')),
  provider_event_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, provider_event_id)
);
alter table public.billing_webhook_events enable row level security;
revoke all on public.billing_webhook_events from anon, authenticated;
