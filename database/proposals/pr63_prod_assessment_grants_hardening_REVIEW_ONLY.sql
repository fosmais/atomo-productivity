-- MYRYRA PR #63 P0: proposed forward-only PROD grant hardening.
-- REVIEW ONLY. NOT APPLIED. Must be validated on an isolated clone and reviewed
-- against all direct-client mutation paths before deployment.
-- Live PROD schema verified 2026-11-20:
-- learning progress has no assessed_exercise_id; assessment policy and assigned
-- exercises tables absent. Existing credit trigger must not be removed.
BEGIN;
-- Application server uses createSupabaseAdmin for answer/feedback/mission status writes.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.myryra_journey_learning_progress
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.myryra_journey_learning_progress TO authenticated;
REVOKE UPDATE ON TABLE public.myryra_journey_missions FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE public.myryra_journey_missions
  FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE public.myryra_journey_learning_progress
  FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE public.myryra_journey_myra_ledger
  FROM PUBLIC, anon, authenticated;
COMMIT;
-- Note: this phase does NOT install a database assessment guard. It cannot be
-- considered sufficient to release MYRA completion until the required assessment
-- dependencies and guard triggers are deployed and authenticated E2E passes.
