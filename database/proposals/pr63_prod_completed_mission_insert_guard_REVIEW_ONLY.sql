-- PR #63 — REVIEW ONLY: fail-closed guard for direct completed mission INSERT.
-- This is a proposed companion to pr63_prod_assessment_grants_hardening_REVIEW_ONLY.sql.
-- It has NOT been executed or validated by authenticated E2E.
-- PROD schema lacks assessment policy and assigned-exercise tables; do not
-- transplant staging guards which reference those missing tables.
--
-- Compatibility review required: identify any legitimate workflow that
-- inserts an already-completed mission, including service-role imports.
BEGIN;
CREATE OR REPLACE FUNCTION public.myryra_reject_completed_mission_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $guard$
BEGIN
  IF NEW.status = 'completed' THEN
    RAISE EXCEPTION 'Create missions as pending; complete through the authorized assessment workflow.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION public.myryra_reject_completed_mission_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER myryra_reject_completed_mission_insert
  BEFORE INSERT ON public.myryra_journey_missions
  FOR EACH ROW
  EXECUTE FUNCTION public.myryra_reject_completed_mission_insert();
COMMIT;
-- This guard blocks completed INSERT but does not replace the full
-- assessment check on UPDATE. The existing MYRA credit trigger remains intact.
-- Do not deploy until full guard and migration dependencies are reviewed.
