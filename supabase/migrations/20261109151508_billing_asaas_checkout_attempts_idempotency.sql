create table if not exists public.billing_asaas_checkout_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_id text not null check (plan_id in ('pro','premium')),
 state text not null default 'reserved' check (state in ('reserved','customer_linked','subscription_created','failed','manual_review')),
 provider_subscription_id text unique,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint subscription_id_state_consistency check (state <> 'subscription_created' or provider_subscription_id is not null)
);
create unique index if not exists billing_asaas_one_open_attempt_per_user
 on public.billing_asaas_checkout_attempts(user_id)
 where state in ('reserved','customer_linked','subscription_created','manual_review');
create index if not exists billing_asaas_checkout_attempts_created_idx on public.billing_asaas_checkout_attempts(created_at);
alter table public.billing_asaas_checkout_attempts enable row level security;
revoke all on public.billing_asaas_checkout_attempts from anon, authenticated;
grant select,insert,update on public.billing_asaas_checkout_attempts to service_role;