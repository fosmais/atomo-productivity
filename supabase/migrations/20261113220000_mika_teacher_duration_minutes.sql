-- Store actual lesson duration; legacy lessons default to 30 minutes.
-- Deploy to homologation first. Do not apply directly to production.
ALTER TABLE public.mika_teacher_sessions
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 30;

ALTER TABLE public.mika_teacher_sessions
  DROP CONSTRAINT IF EXISTS mika_teacher_sessions_duration_minutes_check;
ALTER TABLE public.mika_teacher_sessions
  ADD CONSTRAINT mika_teacher_sessions_duration_minutes_check
  CHECK (duration_minutes IN (15, 20, 30, 45, 60));
