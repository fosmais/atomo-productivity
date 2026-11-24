-- Run ONLY against the dedicated MYRYRA staging project.
-- Synthetic fixtures are checked before any mutation.
-- Entire test is rolled back, including trigger-generated MYRA credits.
BEGIN;
DO $$
DECLARE
  r record;
  fixture_count integer := 0;
  credit_count integer;
  credit_amount integer;
  retained_count integer;
BEGIN
  IF (SELECT count(*) FROM public.myryra_journeys
      WHERE title LIKE '[MYRYRA-STAGING-TEST]%') <> 2 THEN
    RAISE EXCEPTION 'Expected exactly two synthetic staging journeys';
  END IF;

  FOR r IN
    SELECT m.id AS mission_id, m.journey_id, j.owner_id
    FROM public.myryra_journey_missions m
    JOIN public.myryra_journeys j ON j.id = m.journey_id
    WHERE j.title LIKE '[MYRYRA-STAGING-TEST]%'
      AND m.title LIKE '[MYRYRA-STAGING-TEST]%'
  LOOP
    fixture_count := fixture_count + 1;

    IF EXISTS (
      SELECT 1 FROM public.myryra_journey_myra_ledger
      WHERE source_mission_id = r.mission_id
    ) THEN
      RAISE EXCEPTION 'Existing credit for fixture: %', r.mission_id;
    END IF;

    UPDATE public.myryra_journey_missions
      SET status = 'completed', completed_at = now()
      WHERE id = r.mission_id AND status = 'pending';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Mission is not pending: %', r.mission_id;
    END IF;

    SELECT count(*), coalesce(sum(amount), 0)
      INTO credit_count, credit_amount
      FROM public.myryra_journey_myra_ledger
      WHERE source_mission_id = r.mission_id AND owner_id = r.owner_id;
    IF credit_count <> 1 OR credit_amount <> 10 THEN
      RAISE EXCEPTION 'Expected one 10 MYRA credit for %', r.mission_id;
    END IF;

    DELETE FROM public.myryra_journey_missions WHERE id = r.mission_id;

    SELECT count(*) INTO retained_count
      FROM public.myryra_journey_myra_ledger
      WHERE source_mission_id = r.mission_id
        AND owner_id = r.owner_id
        AND mission_id IS NULL
        AND journey_id = r.journey_id
        AND amount = 10;
    IF retained_count <> 1 THEN
      RAISE EXCEPTION 'Credit not retained after mission delete: %', r.mission_id;
    END IF;

    DELETE FROM public.myryra_journeys WHERE id = r.journey_id;

    SELECT count(*) INTO retained_count
      FROM public.myryra_journey_myra_ledger
      WHERE source_mission_id = r.mission_id
        AND owner_id = r.owner_id
        AND mission_id IS NULL
        AND journey_id IS NULL
        AND amount = 10;
    IF retained_count <> 1 THEN
      RAISE EXCEPTION 'Credit not retained after journey delete: %', r.journey_id;
    END IF;
  END LOOP;

  IF fixture_count <> 2 THEN
    RAISE EXCEPTION 'Expected exactly two synthetic missions, got %', fixture_count;
  END IF;
END $$;
ROLLBACK;
