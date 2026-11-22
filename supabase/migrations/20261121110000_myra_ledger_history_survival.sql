-- MYRYRA MVP2 P0: make earned MYRA credits survive physical mission/journey deletion.
-- Backfills immutable source_mission_id before making FK columns nullable.
-- Staging first. Never apply to PROD without release approval and rollback plan.

ALTER TABLE public.myryra_journey_myra_ledger
  ADD COLUMN IF NOT EXISTS source_mission_id uuid;

DO $preflight$
DECLARE
  v_duplicates bigint;
  v_unrecoverable bigint;
BEGIN
  IF to_regclass('public.myryra_journey_myra_ledger') IS NULL
     OR to_regclass('public.myryra_journeys') IS NULL
     OR to_regclass('public.myryra_journey_missions') IS NULL THEN
    RAISE EXCEPTION 'MYRA history migration preflight failed: required tables are missing';
  END IF;

  SELECT count(*) INTO v_unrecoverable
  FROM public.myryra_journey_myra_ledger
  WHERE source_mission_id IS NULL AND mission_id IS NULL;
  IF v_unrecoverable > 0 THEN
    RAISE EXCEPTION 'MYRA history migration found ledger rows without a recoverable mission source';
  END IF;

  SELECT count(*) INTO v_duplicates
  FROM (
    SELECT coalesce(source_mission_id, mission_id) AS source_id
    FROM public.myryra_journey_myra_ledger
    GROUP BY coalesce(source_mission_id, mission_id)
    HAVING count(*) > 1
  ) d;
  IF v_duplicates > 0 THEN
    RAISE EXCEPTION 'MYRA history migration found duplicate mission credits';
  END IF;
END;
$preflight$;

UPDATE public.myryra_journey_myra_ledger
SET source_mission_id = mission_id
WHERE source_mission_id IS NULL AND mission_id IS NOT NULL;

DO $constraints$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.myryra_journey_myra_ledger
    WHERE source_mission_id IS NULL
  ) THEN
    RAISE EXCEPTION 'MYRA history migration cannot make source_mission_id NOT NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.myryra_journey_myra_ledger'::regclass
      AND conname='myryra_journey_myra_ledger_source_mission_key'
  ) THEN
    ALTER TABLE public.myryra_journey_myra_ledger
      ADD CONSTRAINT myryra_journey_myra_ledger_source_mission_key
      UNIQUE (source_mission_id);
  END IF;
END;
$constraints$;

ALTER TABLE public.myryra_journey_myra_ledger
  ALTER COLUMN source_mission_id SET NOT NULL,
  ALTER COLUMN journey_id DROP NOT NULL,
  ALTER COLUMN mission_id DROP NOT NULL;

ALTER TABLE public.myryra_journey_myra_ledger
  DROP CONSTRAINT IF EXISTS myryra_journey_myra_ledger_journey_id_fkey,
  DROP CONSTRAINT IF EXISTS myryra_journey_myra_ledger_mission_id_fkey;

ALTER TABLE public.myryra_journey_myra_ledger
  ADD CONSTRAINT myryra_journey_myra_ledger_journey_id_fkey
    FOREIGN KEY (journey_id) REFERENCES public.myryra_journeys(id) ON DELETE SET NULL,
  ADD CONSTRAINT myryra_journey_myra_ledger_mission_id_fkey
    FOREIGN KEY (mission_id) REFERENCES public.myryra_journey_missions(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.myryra_credit_completed_mission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    INSERT INTO public.myryra_journey_myra_ledger(owner_id, journey_id, mission_id, source_mission_id)
    SELECT j.owner_id, j.id, NEW.id, NEW.id
    FROM public.myryra_journeys j
    WHERE j.id = NEW.journey_id
    ON CONFLICT (source_mission_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
