-- MYRYRA MVP2: remove direct client mutations that can bypass server checks
-- or cascade-delete earned MYRA history. Server routes use service_role only
-- after authenticating the user, checking ownership/MFA/legal acceptance,
-- and validating the assessment. Never apply to PROD without reviewed release.

DO $preflight$
BEGIN
  IF to_regclass('public.myryra_journeys') IS NULL
     OR to_regclass('public.myryra_journey_missions') IS NULL
     OR to_regclass('public.myryra_journey_learning_progress') IS NULL THEN
    RAISE EXCEPTION 'Journey client-mutation hardening preflight failed: required tables are missing';
  END IF;
END;
$preflight$;

REVOKE UPDATE, DELETE ON TABLE public.myryra_journeys FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE ON TABLE public.myryra_journey_missions FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.myryra_journey_learning_progress FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.myryra_journey_learning_progress TO authenticated;

DROP POLICY IF EXISTS journeys_delete_owner ON public.myryra_journeys;
DROP POLICY IF EXISTS missions_delete_owner ON public.myryra_journey_missions;

-- No direct client write privilege is restored. Trusted server writes are
-- separately granted to service_role by 20261121100000.
