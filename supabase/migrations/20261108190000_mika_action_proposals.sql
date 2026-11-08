-- MIKA Agent: durable, user-scoped action proposals and execution audit.
-- Apply in a reviewed migration before enabling execution in any environment.
create table if not exists public.mika_action_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('create_task','create_event','create_reminder')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending','approved','rejected','executing','executed','failed','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  approved_at timestamptz,
  executed_at timestamptz,
  result jsonb,
  constraint mika_action_proposal_expiry check (expires_at > created_at)
);
create index if not exists mika_action_proposals_user_created_idx
  on public.mika_action_proposals(user_id,created_at desc);
create index if not exists mika_action_proposals_pending_idx
  on public.mika_action_proposals(user_id,expires_at) where status = 'pending';
alter table public.mika_action_proposals enable row level security;
revoke all on public.mika_action_proposals from anon, authenticated;
grant select, insert on public.mika_action_proposals to authenticated;
create policy "Users can read own action proposals"
  on public.mika_action_proposals for select to authenticated
  using ((select auth.uid()) = user_id);
-- Users can only create their own pending proposals; no direct updates/deletes.
-- Client inserts are NOT proof that the model generated a proposal.
create policy "Users can submit own pending proposals"
  on public.mika_action_proposals for insert to authenticated
  with check (
    (select auth.uid()) = user_id and status = 'pending'
    and approved_at is null and executed_at is null and result is null
    and expires_at > now() and expires_at <= now() + interval '30 minutes'
  );
-- Approval and execution require an independently verified atomic server path.
create table if not exists public.mika_action_audit (
  id bigint generated always as identity primary key,
  proposal_id uuid not null references public.mika_action_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('proposed','approved','rejected','started','succeeded','failed','expired')),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists mika_action_audit_user_idx
  on public.mika_action_audit(user_id,created_at desc);
alter table public.mika_action_audit enable row level security;
revoke all on public.mika_action_audit from anon, authenticated;
grant select on public.mika_action_audit to authenticated;
create policy "Users can read own action audit"
  on public.mika_action_audit for select to authenticated
  using ((select auth.uid()) = user_id);
