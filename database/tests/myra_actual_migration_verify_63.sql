-- Validate actual migration against synthetic pre-migration shape.
DO $$
BEGIN
 IF (SELECT count(*) FROM public.myryra_journey_myra_ledger) <> 1
 OR (SELECT sum(amount) FROM public.myryra_journey_myra_ledger) <> 10
 OR NOT EXISTS (SELECT 1 FROM public.myryra_journey_myra_ledger WHERE source_mission_id='00000000-0000-4000-8000-000000000201')
 THEN RAISE EXCEPTION 'Migration lost existing credit or source key'; END IF;
END $$;
CREATE TRIGGER rehearsal_credit AFTER INSERT OR UPDATE OF status ON public.myryra_journey_missions
FOR EACH ROW EXECUTE FUNCTION public.myryra_credit_completed_mission();
UPDATE public.myryra_journey_missions SET status='completed'
WHERE id='00000000-0000-4000-8000-000000000202';
UPDATE public.myryra_journey_missions SET status='pending'
WHERE id='00000000-0000-4000-8000-000000000202';
UPDATE public.myryra_journey_missions SET status='completed'
WHERE id='00000000-0000-4000-8000-000000000202';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.myryra_journey_myra_ledger) <> 2
 OR (SELECT sum(amount) FROM public.myryra_journey_myra_ledger) <> 20
 THEN RAISE EXCEPTION 'Credit trigger not idempotent'; END IF;
END $$;
DELETE FROM public.myryra_journeys WHERE id='00000000-0000-4000-8000-000000000101';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.myryra_journey_myra_ledger) <> 2
 OR (SELECT sum(amount) FROM public.myryra_journey_myra_ledger) <> 20
 OR (SELECT count(*) FROM public.myryra_journey_myra_ledger WHERE journey_id IS NULL AND mission_id IS NULL) <> 2
 THEN RAISE EXCEPTION 'Credits lost after parent deletion'; END IF;
END $$;
