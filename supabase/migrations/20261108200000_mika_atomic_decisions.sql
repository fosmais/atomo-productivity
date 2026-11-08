-- MIKA MVP2: explicit, atomic approval/rejection; never executes actions.
-- Requires 20261108190000_mika_action_proposals.sql.
create or replace function public.mika_decide_proposal(p_proposal_id uuid, p_approve boolean)
returns table(proposal_id uuid, decision_status text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_proposal public.mika_action_proposals%rowtype;
  v_status text;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v_proposal
  from public.mika_action_proposals
  where id = p_proposal_id and user_id = v_user
  for update;
  if not found then raise exception 'proposal_not_found' using errcode = 'P0002'; end if;
  if v_proposal.status <> 'pending' then
    raise exception 'proposal_already_decided' using errcode = 'P0001';
  end if;
  if v_proposal.expires_at <= now() then
    update public.mika_action_proposals set status = 'expired'
    where id = p_proposal_id;
    insert into public.mika_action_audit(proposal_id,user_id,event_type)
    values (p_proposal_id,v_user,'expired');
    raise exception 'proposal_expired' using errcode = '22023';
  end if;
  v_status := case when p_approve then 'approved' else 'rejected' end;
  update public.mika_action_proposals
  set status = v_status, approved_at = case when p_approve then now() else null end
  where id = p_proposal_id;
  insert into public.mika_action_audit(proposal_id,user_id,event_type)
  values (p_proposal_id,v_user,case when p_approve then 'approved' else 'rejected' end);
  return query select p_proposal_id, v_status;
end;
$$;
revoke all on function public.mika_decide_proposal(uuid,boolean) from public, anon;
grant execute on function public.mika_decide_proposal(uuid,boolean) to authenticated;
