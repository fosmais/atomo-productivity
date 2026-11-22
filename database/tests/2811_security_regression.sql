-- MYRYRA 28.11: read-only security regression checks.
-- Run as a database administrator; no user data is modified.
-- Each assertion raises an error if a security invariant is broken.
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.events'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.tasks'::regclass) THEN
    RAISE EXCEPTION 'RLS missing on tasks/events';
  END IF;
  IF has_function_privilege('anon', 'public.reserve_autopilot_task(uuid,timestamptz,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous user can reserve AutoPilot tasks';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.reserve_autopilot_task(uuid,timestamptz,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated user cannot reserve AutoPilot tasks';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='events'
      AND indexname='events_autopilot_task_once_per_user_idx'
      AND indexdef ILIKE '%UNIQUE INDEX%'
  ) THEN
    RAISE EXCEPTION 'Unique AutoPilot reservation index missing';
  END IF;
  IF has_table_privilege('anon', 'public.google_calendar_connections', 'SELECT')
     OR has_table_privilege('authenticated', 'public.google_calendar_connections', 'SELECT') THEN
    RAISE EXCEPTION 'Google Calendar connection table exposed';
  END IF;
END $$;

-- Observational checks: overlap can be valid for manually created events.
SELECT count(*) AS duplicate_autopilot_reservations FROM (
  SELECT user_id, notes FROM public.events
  WHERE notes LIKE 'Tarefa MYRYRA: %'
  GROUP BY user_id, notes HAVING count(*) > 1
) duplicates;
