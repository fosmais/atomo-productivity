-- MYRYRA MVP2 / Journey MYRA: read-only structural regression.
-- Run only against the intended staging project. No fixture data or user secrets.
-- This test does not replace authenticated API/E2E or concurrency tests.
DO $$
DECLARE
  missing_constraints text;
  trigger_count integer;
BEGIN
  SELECT string_agg(required_name, ', ') INTO missing_constraints
  FROM (VALUES
    ('myryra_journey_myra_ledger_source_mission_key'),
    ('myryra_journey_myra_ledger_mission_id_key'),
    ('myryra_journey_myra_ledger_amount_check'),
    ('myryra_journey_myra_ledger_reason_check')
  ) AS required(required_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.myryra_journey_myra_ledger'::regclass
      AND c.conname = required.required_name
      AND c.convalidated
  );
  IF missing_constraints IS NOT NULL THEN
    RAISE EXCEPTION 'MYRA ledger constraints missing: %', missing_constraints;
  END IF;

  SELECT count(*) INTO trigger_count FROM pg_trigger
  WHERE tgrelid = 'public.myryra_journey_missions'::regclass
    AND NOT tgisinternal
    AND tgenabled IN ('O', 'A')
    AND tgname IN (
      'myryra_assessed_mission_completion_guard',
      'myryra_guard_completed_mission_insert',
      'myryra_mission_credit_myra'
    );
  IF trigger_count <> 3 THEN
    RAISE EXCEPTION 'Expected 3 mission guards/credit triggers, found %', trigger_count;
  END IF;

  IF has_table_privilege('authenticated',
       'public.myryra_journey_myra_ledger', 'INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Authenticated role can directly mutate MYRA ledger';
  END IF;

  IF has_table_privilege('anon',
       'public.myryra_journey_myra_ledger', 'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Anonymous role has MYRA ledger privileges';
  END IF;


  -- The trigger functions must not be callable as public RPCs.
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'myryra_credit_completed_mission',
        'myryra_guard_assessed_mission_completion',
        'myryra_guard_client_completed_mission_insert'
      )
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ) THEN
    RAISE EXCEPTION 'A MYRA trigger function is directly executable by clients';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    WHERE c.oid IN (
      'public.myryra_journeys'::regclass,
      'public.myryra_journey_missions'::regclass,
      'public.myryra_journey_myra_ledger'::regclass
    ) AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Journey/MYRA table missing RLS';
  END IF;

  IF has_table_privilege('authenticated',
       'public.myryra_journey_missions', 'UPDATE') THEN
    RAISE EXCEPTION 'Authenticated role can directly update missions';
  END IF;

  IF has_table_privilege('authenticated',
       'public.myryra_journeys', 'UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Authenticated role can directly update/delete journeys';
  END IF;

  RAISE NOTICE 'MYRA structural regression passed';
END $$;
