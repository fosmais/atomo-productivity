-- Prevent client roles from bypassing RLS using table-wide operations.
revoke truncate, trigger, references on public.myryra_journey_missions from public, anon, authenticated;
revoke truncate, trigger, references on public.myryra_journey_learning_progress from public, anon, authenticated;
revoke truncate, trigger, references on public.myryra_journey_myra_ledger from public, anon, authenticated;