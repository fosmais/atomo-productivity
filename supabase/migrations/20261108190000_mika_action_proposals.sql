-- MIKA Agent: durable, user-scoped action proposals and execution audit.
-- Apply in a reviewed migration before enabling execution in any environment.
create table if not exists public.mika_action_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('create_task','create_event','create_reminder')),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and payload ? 'type' and payload->>'type' = action_type
    and jsonb_typeof(payload->'title') = 'string'
    and length(btrim(payload->>'title')) between 3 and 160
    and jsonb_typeof(payload->'reason') = 'string'
    and length(payload->>'reason') <= 500
    and payload ? 'due_at'
    and (payload->'due_at' = 'null'::jsonb or jsonb_typeof(payload->'due_at') = 'string')
  ),
  status text not null default 'pending' check (status in ('pending','approved','rejected','executing','executed','failed','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  approved_at timestamptz,
  executed_at timestamptz,
  result jsonb,
  execution_key uuid unique,
  constraint mika_action_proposal_expiry check (expires_at > created_at)
);
create index if not exists mika_action_proposals_user_created_idx
  on public.mika_action_proposals(user_id,created_at desc);
create index if not exists mika_action_proposals_pending_idx
  on public.mika_action_proposals(user_id,expires_at) where status = 'pending';
alter table public.mika_action_proposals enable row level security;
revoke all on public.mika_action_proposals from anon, authenticated;
grant select on public.mika_action_proposals to authenticated;
create policy "Users can read own action proposals"
  on public.mika_action_proposals for select to authenticated
  using ((select auth.uid()) = user_id);
-- Proposals are created only by trusted server-side code.\n-- Authenticated Data API clients cannot forge model-generated proposals.\n-- Approval and execution require an independently verified atomic server path.
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

-- Immutable audit: clients cannot insert, update or delete events.
-- The server-side approval workflow must append events using a reviewed,
-- authenticated database function or another trusted server mechanism.
-- Prevent mismatched user_id values in audit rows even from privileged writes.
create unique index if not exists mika_action_proposals_id_user_idx
  on public.mika_action_proposals(id, user_id);
alter table public.mika_action_audit
  add constraint mika_action_audit_owner_fk
  foreign key (proposal_id, user_id)
  references public.mika_action_proposals(id, user_id) on delete cascade;

-- Execution claim must be unique and assigned by trusted server logic only.
-- Keep the execution endpoint disabled until approval, consent and
-- transactional claiming are implemented and tested end to end.
create unique index if not exists mika_action_audit_proposal_event_once_idx
  on public.mika_action_audit(proposal_id, event_type)
  where event_type in ('proposed', 'approved', 'rejected', 'started', 'succeeded', 'expired');

-- Consent ledger. No existing user is automatically marked as accepted.
-- Legal document versions must be reviewed and published before recording acceptance.
create table if not exists public.myryra_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('terms','privacy')),
  document_version text not null check (length(document_version) between 1 and 80),
  accepted_at timestamptz not null default now(),
  unique(user_id, document_type, document_version)
);
create index if not exists myryra_legal_acceptances_user_idx
  on public.myryra_legal_acceptances(user_id);
alter table public.myryra_legal_acceptances enable row level security;
revoke all on public.myryra_legal_acceptances from anon, authenticated;
grant select on public.myryra_legal_acceptances to authenticated;
create policy "Users can read own legal acceptances"
  on public.myryra_legal_acceptances for select to authenticated
  using ((select auth.uid()) = user_id);
-- Only trusted server-side code may insert acceptance records after explicit user action.\n-- No INSERT, UPDATE or DELETE grants for authenticated Data API clients.
