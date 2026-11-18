-- Issue #58: prevent authenticated clients from physically deleting Journeys.
-- REVIEW REQUIRED: apply only after verifying legacy clients, staging E2E,
-- production grants and rollback plan. This file is NOT executed by this commit.
-- Soft archive must remain available through the authorized server API.
BEGIN;
REVOKE DELETE ON TABLE public.myryra_journeys FROM authenticated;
DROP POLICY IF EXISTS journeys_delete_owner ON public.myryra_journeys;
COMMIT;
