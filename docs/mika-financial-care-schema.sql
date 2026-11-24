-- Staged only. Review in isolated sandbox before applying.
create table if not exists public.billing_financial_care_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 subscription_id uuid references public.billing_subscriptions(id),
 action text not null check (action in ('cancel_renewal','downgrade','request_refund')),
 target_plan text check (target_plan in ('free','pro')),
 provider_payment_id text,
 reason text,
 status text not null default 'pending_review' check (status in ('pending_review','approved','processing','completed','rejected','needs_recovery')),
 idempotency_key uuid not null,
 confirmed_at timestamptz not null,
 effective_at timestamptz,
 provider_reference text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (user_id,idempotency_key),
 constraint financial_care_action_fields check (
 (action='cancel_renewal' and target_plan is null and provider_payment_id is null)
 or (action='downgrade' and target_plan is not null and provider_payment_id is null)
 or (action='request_refund' and provider_payment_id is not null and reason is not null and char_length(reason) between 10 and 1000)
 )
);
create index if not exists billing_financial_care_user_created_idx on public.billing_financial_care_requests(user_id,created_at desc);
alter table public.billing_financial_care_requests enable row level security;
revoke all on public.billing_financial_care_requests from public,anon,authenticated;
grant select on public.billing_financial_care_requests to authenticated;
create policy billing_financial_care_read_own on public.billing_financial_care_requests for select to authenticated using ((select auth.uid())=user_id);
create table if not exists public.billing_financial_care_audit (
 id bigint generated always as identity primary key,
 request_id uuid not null references public.billing_financial_care_requests(id),
 actor_id uuid references auth.users(id),
 event_type text not null,
 old_status text,
 new_status text,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.billing_financial_care_audit enable row level security;
revoke all on public.billing_financial_care_audit from public,anon,authenticated;
-- All writes must occur from a server-side authenticated operation, never from the browser.
