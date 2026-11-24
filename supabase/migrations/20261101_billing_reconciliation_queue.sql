-- MYRYRA MVP1: staging only. Do not apply before review and Sandbox approval.
-- This table queues authenticated Asaas webhook receipts for independent verification.
-- It deliberately does not modify billing_subscriptions or grant entitlements.
create table if not exists public.billing_reconciliation_jobs (
  id bigint generated always as identity primary key,
  provider text not null check (provider = 'asaas'),
  provider_event_id text not null,
  event_type text not null,
  provider_payment_id text,
  state text not null default 'pending'
    check (state in ('pending', 'processing', 'verified', 'rejected', 'retry')),
  attempts integer not null default 0 check (attempts between 0 and 20),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_event_id),
  check (length(provider_event_id) between 1 and 128),
  check (length(event_type) between 1 and 100)
);

create index if not exists billing_reconciliation_jobs_pending
  on public.billing_reconciliation_jobs (next_attempt_at, id)
  where state in ('pending', 'retry');

alter table public.billing_reconciliation_jobs enable row level security;
revoke all on public.billing_reconciliation_jobs from anon, authenticated;
-- No user-facing RLS policies. Only service-role processing is allowed.
comment on table public.billing_reconciliation_jobs is
  'Internal Asaas audit/reconciliation queue; never direct proof of entitlement.';
