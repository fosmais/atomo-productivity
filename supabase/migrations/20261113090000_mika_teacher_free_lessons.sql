-- Allow standalone teacher lessons while retaining the existing Journey FK.
-- Deploy only with API/UI support for null journey_id; do not apply directly to production.
ALTER TABLE public.mika_teacher_sessions
  ALTER COLUMN journey_id DROP NOT NULL;

DROP POLICY IF EXISTS "teacher sessions insert own journey" ON public.mika_teacher_sessions;
CREATE POLICY "teacher sessions insert own or free lesson"
ON public.mika_teacher_sessions
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = owner_id
  AND (
    journey_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.myryra_journeys AS j
      WHERE j.id = journey_id
        AND j.owner_id = (SELECT auth.uid())
        AND j.status = 'active'
    )
  )
);

-- The existing owner-scoped UPDATE policy is ineffective without table privileges.
-- Only allow the fields needed to reschedule an active lesson.
GRANT UPDATE (scheduled_at) ON TABLE public.mika_teacher_sessions TO authenticated;

-- SELECT/UPDATE/DELETE ownership policies remain unchanged.
-- Rollback after confirming no free lessons exist:
-- REVOKE UPDATE (scheduled_at) ON TABLE public.mika_teacher_sessions FROM authenticated;
-- ALTER TABLE public.mika_teacher_sessions ALTER COLUMN journey_id SET NOT NULL;
-- Recreate original INSERT policy from the preceding migration before rollback.
