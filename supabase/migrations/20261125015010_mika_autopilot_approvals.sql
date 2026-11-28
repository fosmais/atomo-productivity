create table public.mika_autopilot_approvals (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 proposal_digest text not null check (proposal_digest ~ '^[0-9a-f]{64}$'),
 slots jsonb not null check (case when jsonb_typeof(slots)='array' then jsonb_array_length(slots) between 1 and 100 else false end),
 approved_at timestamptz not null default now(),
 expires_at timestamptz not null,
 constraint mika_approval_expiry check (expires_at > approved_at),
 unique(user_id,proposal_digest)
);
alter table public.mika_autopilot_approvals enable row level security;
revoke all on public.mika_autopilot_approvals from public, anon, authenticated, service_role;
grant select on public.mika_autopilot_approvals to authenticated;
grant select, insert on public.mika_autopilot_approvals to service_role;
create policy mika_approval_owner_read on public.mika_autopilot_approvals for select to authenticated using ((select auth.uid())=user_id);
