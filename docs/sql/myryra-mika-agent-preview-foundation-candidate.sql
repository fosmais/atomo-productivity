-- Isolated candidate reconstructed from BOTH preview branches; NEVER apply to PROD.
-- Requires Supabase auth.users and auth.uid(), and authenticated role.
begin;
create table public.mika_action_proposals (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 action_type text not null check (action_type in ('create_task','create_event','create_reminder')),
 payload jsonb not null,
 status text not null default 'pending' check (status in ('pending','approved','rejected','executing','executed','failed','expired')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '30 minutes'),
 approved_at timestamptz,
 executed_at timestamptz,
 result jsonb,
 execution_key uuid unique,
 constraint mika_action_proposal_expiry check (expires_at > created_at),
 constraint mika_action_proposals_check check (
  jsonb_typeof(payload)='object' and payload ? 'type'
  and payload->>'type'=action_type
  and jsonb_typeof(payload->'title')='string'
  and length(btrim(payload->>'title')) between 3 and 160
  and jsonb_typeof(payload->'reason')='string'
  and length(payload->>'reason')<=500
  and payload ? 'due_at'
  and (payload->'due_at'='null'::jsonb or jsonb_typeof(payload->'due_at')='string')
 )
);
create unique index mika_action_proposals_id_user_idx on public.mika_action_proposals(id,user_id);
create index mika_action_proposals_pending_idx on public.mika_action_proposals(user_id,expires_at) where status='pending';
create index mika_action_proposals_user_created_idx on public.mika_action_proposals(user_id,created_at desc);
create table public.mika_action_audit (
 id bigint generated always as identity primary key,
 proposal_id uuid not null references public.mika_action_proposals(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 event_type text not null check (event_type in ('proposed','approved','rejected','started','succeeded','failed','expired')),
 created_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb,
 constraint mika_action_audit_owner_fk foreign key (proposal_id,user_id)
  references public.mika_action_proposals(id,user_id) on delete cascade
);
create unique index mika_action_audit_proposal_event_once_idx
 on public.mika_action_audit(proposal_id,event_type)
 where event_type in ('proposed','approved','rejected','started','succeeded','expired');
create index mika_action_audit_user_idx on public.mika_action_audit(user_id,created_at desc);
alter table public.mika_action_proposals enable row level security;
alter table public.mika_action_audit enable row level security;
create policy "Users can read own action proposals" on public.mika_action_proposals
 for select to authenticated using ((select auth.uid())=user_id);
create policy "Users can read own action audit" on public.mika_action_audit
 for select to authenticated using ((select auth.uid())=user_id);
-- Both preview branches grant authenticated SELECT on these tables.
grant select on public.mika_action_proposals, public.mika_action_audit to authenticated;
commit;
