-- Revoke direct mutation of assessment evidence and mission completion.
-- Trusted API endpoints use service role after ownership and assessment checks.
revoke update on public.myryra_journey_missions from public, anon, authenticated;
revoke insert, update, delete, truncate on public.myryra_journey_learning_progress from public, anon, authenticated;
grant select on public.myryra_journey_learning_progress to authenticated;
-- Keep mission creation/deletion grants unchanged for legacy Journey workflows.
