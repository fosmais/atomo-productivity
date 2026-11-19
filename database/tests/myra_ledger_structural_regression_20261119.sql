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
  );
  IF missing_constraints IS NOT NULL THEN
    RAISE EXCEPTION 'MYRA ledger constraints missing: %', missing_constraints;
  END IF;

  SELECT count(*) INTO trigger_count FROM pg_trigger
  WHERE tgrelid = 'public.myryra_journey_missions'::regclass
    AND NOT tgisinternal
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

  RAISE NOTICE 'MYRA structural regression passed';
END $$;
