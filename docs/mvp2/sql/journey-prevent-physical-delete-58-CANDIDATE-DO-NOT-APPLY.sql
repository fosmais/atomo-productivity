-- Issue #58 — CANDIDATE ONLY. DO NOT APPLY AUTOMATICALLY.
-- Requires explicit approval, grants/RLS inventory, rollback and staging E2E.
-- Preserve historical missions, assessments and MYRA credits by using soft archive.
BEGIN;
REVOKE DELETE ON TABLE public.myryra_journeys FROM authenticated;
DROP POLICY IF EXISTS journeys_delete_owner ON public.myryra_journeys;
COMMIT;
