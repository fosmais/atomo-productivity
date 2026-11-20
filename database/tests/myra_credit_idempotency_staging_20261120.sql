-- MYRYRA MVP2 / staging-only MYRA idempotency regression.
-- Run only on staging with the two synthetic fixtures present.
-- The transaction always rolls back. This does NOT test concurrent HTTP requests.
BEGIN;
DO $$
DECLARE
  fixture record;
  credits integer;
  total_amount integer;
  tested integer := 0;
BEGIN
  FOR fixture IN
    SELECT m.id AS mission_id
    FROM public.myryra_journey_missions m
    JOIN public.myryra_journeys j ON j.id = m.journey_id
    WHERE j.title = '[MYRYRA-STAGING-TEST] Jornada de homologação'
      AND m.title = '[MYRYRA-STAGING-TEST] Missão de crédito único'
      AND m.status = 'pending'
    ORDER BY m.id
  LOOP
    tested := tested + 1;
    UPDATE public.myryra_journey_missions SET status = 'completed'
      WHERE id = fixture.mission_id;
    SELECT count(*), coalesce(sum(amount),0) INTO credits,total_amount
      FROM public.myryra_journey_myra_ledger
      WHERE source_mission_id = fixture.mission_id;
    IF credits <> 1 OR total_amount <> 10 THEN
      RAISE EXCEPTION 'First completion failed for mission %: count %, amount %',
        fixture.mission_id, credits, total_amount;
    END IF;

    UPDATE public.myryra_journey_missions SET status = 'pending'
      WHERE id = fixture.mission_id;
    UPDATE public.myryra_journey_missions SET status = 'completed'
      WHERE id = fixture.mission_id;
    SELECT count(*), coalesce(sum(amount),0) INTO credits,total_amount
      FROM public.myryra_journey_myra_ledger
      WHERE source_mission_id = fixture.mission_id;
    IF credits <> 1 OR total_amount <> 10 THEN
      RAISE EXCEPTION 'Repeated completion duplicated credits for mission %: count %, amount %',
        fixture.mission_id, credits, total_amount;
    END IF;
  END LOOP;
  IF tested <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 pending synthetic missions, got %', tested;
  END IF;
  RAISE NOTICE 'PASS: % synthetic missions credited exactly once on repeated completion', tested;
END $$;
ROLLBACK;
