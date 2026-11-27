-- Allow server-issued immutable exercises without granting client writes.
GRANT INSERT ON public.myryra_journey_assigned_exercises TO service_role;
