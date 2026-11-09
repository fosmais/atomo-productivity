-- MIKA Agente MVP2 — staging-only SQL. Do not apply to production before security review.
-- Proposals are created by trusted backend using service credentials, never by browser.
create table if not exists public.mika_action_proposals (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('reserve_focus','create_task','create_event')),
 payload jsonb not null,
 payload_digest text not null check (payload_digest ~ '^[a-f0-9]{64}$'),
 status text not null default 'proposed' check (status in ('proposed','approved','executing','succeeded','failed','rejected','expired')),
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 expires_at timestamptz not null,
 execution_started_at timestamptz,
 finished_at timestamptz,
 result_ref uuid,
 failure_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint mika_approval_consistency check (status not in ('approved','executing','succeeded') or (approved_by = user_id and approved_at is not null))
);
create index if not exists mika_proposals_owner_created on public.mika_action_proposals(user_id,created_at desc);
create table if not exists public.mika_action_audit (
 id bigint generated always as identity primary key,
 proposal_id uuid not null references public.mika_action_proposals(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 transition text not null,
 occurred_at timestamptz not null default now(),
 result_code text
);
create index if not exists mika_audit_owner_time on public.mika_action_audit(user_id,occurred_at desc);
alter table public.mika_action_proposals enable row level security;
alter table public.mika_action_audit enable row level security;
revoke all on public.mika_action_proposals from public, anon, authenticated;
revoke all on public.mika_action_audit from public, anon, authenticated;
grant select on public.mika_action_proposals to authenticated;
grant select on public.mika_action_audit to authenticated;
drop policy if exists mika_proposal_owner_read on public.mika_action_proposals;
create policy mika_proposal_owner_read on public.mika_action_proposals for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists mika_audit_owner_read on public.mika_action_audit;
create policy mika_audit_owner_read on public.mika_action_audit for select to authenticated using (user_id = (select auth.uid()));

-- Privileged functions are narrow, explicitly validate auth.uid(), and are
-- callable only by authenticated users. No arbitrary SQL or user-supplied owner.
create or replace function public.mika_approve_action(p_id uuid, p_digest text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_row public.mika_action_proposals%rowtype;
begin
 if v_user is null or p_digest !~ '^[a-f0-9]{64}$' then return false; end if;
 update public.mika_action_proposals
 set status='approved', approved_by=v_user, approved_at=now(), updated_at=now()
 where id=p_id and user_id=v_user and status='proposed'
   and payload_digest=p_digest and expires_at>now()
 returning * into v_row;
 if not found then return false; end if;
 insert into public.mika_action_audit(proposal_id,user_id,transition)
 values (p_id,v_user,'proposed->approved');
 return true;
end $$;
create or replace function public.mika_claim_action(p_id uuid, p_digest text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_row public.mika_action_proposals%rowtype;
begin
 if v_user is null or p_digest !~ '^[a-f0-9]{64}$' then return false; end if;
 update public.mika_action_proposals
 set status='executing', execution_started_at=now(), updated_at=now()
 where id=p_id and user_id=v_user and approved_by=v_user
   and status='approved' and approved_at is not null
   and payload_digest=p_digest and expires_at>now()
 returning * into v_row;
 if not found then return false; end if;
 insert into public.mika_action_audit(proposal_id,user_id,transition)
 values (p_id,v_user,'approved->executing');
 return true;
end $$;
-- Users may reject an unexecuted proposal; the transition is atomic and audited.
create or replace function public.mika_reject_action(p_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $
declare v_user uuid := auth.uid(); v_id uuid;
begin
 if v_user is null then return false; end if;
 update public.mika_action_proposals
 set status='rejected', finished_at=now(), updated_at=now()
 where id=p_id and user_id=v_user and status in ('proposed','approved')
 returning id into v_id;
 if v_id is null then return false; end if;
 insert into public.mika_action_audit(proposal_id,user_id,transition)
 values (p_id,v_user,'user->rejected');
 return true;
end $;
-- Expiration is enforced by approval and claim predicates; this RPC makes
-- expired proposals visible as terminal state without enabling execution.
create or replace function public.mika_expire_action(p_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $
declare v_user uuid := auth.uid(); v_id uuid;
begin
 if v_user is null then return false; end if;
 update public.mika_action_proposals
 set status='expired', finished_at=now(), updated_at=now()
 where id=p_id and user_id=v_user and status in ('proposed','approved')
   and expires_at<=now()
 returning id into v_id;
 if v_id is null then return false; end if;
 insert into public.mika_action_audit(proposal_id,user_id,transition)
 values (p_id,v_user,'pending->expired');
 return true;
end $;
revoke all on function public.mika_approve_action(uuid,text) from public,anon,authenticated;
revoke all on function public.mika_claim_action(uuid,text) from public,anon,authenticated;
grant execute on function public.mika_approve_action(uuid,text) to authenticated;
grant execute on function public.mika_claim_action(uuid,text) to authenticated;
revoke all on function public.mika_reject_action(uuid) from public,anon,authenticated;
revoke all on function public.mika_expire_action(uuid) from public,anon,authenticated;
grant execute on function public.mika_reject_action(uuid) to authenticated;
grant execute on function public.mika_expire_action(uuid) to authenticated;

-- IMPORTANT: claim is a single-winner transaction but NOT an executor.
-- The authenticated caller can claim its own action; this function must NOT
-- be wired to side effects without a trusted server-side execution gate.
-- No client-accessible completion function is exposed in this staging draft.
