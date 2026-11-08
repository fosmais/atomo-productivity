-- Prevent authenticated clients from fabricating model-generated proposals.
-- Proposal generation is authenticated in the API and inserted by server role only.
revoke insert on public.mika_action_proposals from authenticated;
drop policy if exists "Users can submit own pending proposals" on public.mika_action_proposals;
-- Retain owner-scoped SELECT, but no client-side UPDATE/DELETE/INSERT.
