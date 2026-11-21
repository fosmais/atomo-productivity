-- MYRYRA MVP2: least-privilege grants for authenticated server routes.
-- This migration grants writes only to service_role. It does not restore any
-- direct INSERT/UPDATE/DELETE privilege to anon or authenticated clients.
-- Apply to the isolated staging branch first; never apply to PROD automatically.

DO $preflight$
BEGIN
  IF to_regclass('public.myryra_journeys') IS NULL
     OR to_regclass('public.myryra_journey_missions') IS NULL
     OR to_regclass('public.myryra_journey_learning_progress') IS NULL THEN
    RAISE EXCEPTION 'Journey server-write grant preflight failed: required tables are missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'Journey server-write grant preflight failed: service_role is missing';
  END IF;
END;
$preflight$;

GRANT UPDATE ON TABLE public.myryra_journeys TO service_role;
GRANT UPDATE ON TABLE public.myryra_journey_missions TO service_role;
GRANT INSERT, UPDATE ON TABLE public.myryra_journey_learning_progress TO service_role;

-- Intentionally do not grant DELETE on journeys/missions or any ledger write.
