-- MYRYRA Billing: reviewed DDL proposal, NOT applied to Supabase.
-- Apply through the normal migration review only after sandbox end-to-end tests.
-- No public read/write policies: this mapping is service-role only.
begin;

create table if not exists public.billing_asaas_customer_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'asaas' check (provider = 'asaas'),
  provider_customer_id text not null unique
    check (provider_customer_id ~ '^cus_[A-Za-z0-9_-]{3,96}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_asaas_customer_links enable row level security;
revoke all on public.billing_asaas_customer_links from anon, authenticated;
-- service_role is used exclusively by authenticated server-side billing handlers.
grant select, insert, update, delete on public.billing_asaas_customer_links to service_role;

create index if not exists billing_asaas_customer_links_provider_lookup
  on public.billing_asaas_customer_links (provider, provider_customer_id);

commit;

-- Existing billing_subscriptions.user_id is UNIQUE, as is
-- (provider, provider_subscription_id). Reconciliation must verify BOTH
-- the provider customer link and subscription before any entitlement update.
-- This schema alone does not grant entitlements, charge users, or enable checkout.
