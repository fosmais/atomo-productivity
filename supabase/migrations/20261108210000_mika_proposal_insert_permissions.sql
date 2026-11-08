-- Restore narrowly scoped proposal creation in staging and future environments.
-- No client permission to approve, execute, or alter existing proposals.
grant select, insert on public.mika_action_proposals to authenticated;
drop policy if exists "Users can submit own pending proposals" on public.mika_action_proposals;
create policy "Users can submit own pending proposals"
on public.mika_action_proposals for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and approved_at is null and executed_at is null and result is null
  and execution_key is null
  and expires_at > now() and expires_at <= now() + interval '30 minutes'
);
