-- ISOLATED TEST FIXTURE ONLY. Never run against the production database.
-- Requires a fresh local Supabase instance with auth.users already provisioned.
BEGIN;
CREATE TABLE public.myryra_journeys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
 description text, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','archived')),
 visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','shared')),
 target_date date, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), confirmation_key uuid
);
CREATE TABLE public.mika_teacher_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 journey_id uuid REFERENCES public.myryra_journeys(id) ON DELETE CASCADE,
 topic text NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 120),
 level text NOT NULL DEFAULT 'iniciante' CHECK (char_length(level) BETWEEN 1 AND 40),
 scheduled_at timestamptz,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id)
);
CREATE TABLE public.mika_teacher_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL, owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('user','assistant')),
 content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(session_id,owner_id) REFERENCES public.mika_teacher_sessions(id,owner_id) ON DELETE CASCADE
);
ALTER TABLE public.myryra_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mika_teacher_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mika_teacher_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY journeys_select_owner ON public.myryra_journeys FOR SELECT TO authenticated USING ((SELECT auth.uid())=owner_id);
CREATE POLICY journeys_insert_owner ON public.myryra_journeys FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=owner_id);
CREATE POLICY journeys_update_owner ON public.myryra_journeys FOR UPDATE TO authenticated USING ((SELECT auth.uid())=owner_id) WITH CHECK ((SELECT auth.uid())=owner_id);
CREATE POLICY journeys_delete_owner ON public.myryra_journeys FOR DELETE TO authenticated USING ((SELECT auth.uid())=owner_id);
CREATE POLICY "teacher sessions select own" ON public.mika_teacher_sessions FOR SELECT TO authenticated USING ((SELECT auth.uid())=owner_id);
CREATE POLICY "teacher sessions delete own" ON public.mika_teacher_sessions FOR DELETE TO authenticated USING ((SELECT auth.uid())=owner_id);
CREATE POLICY "teacher sessions reschedule own" ON public.mika_teacher_sessions FOR UPDATE TO authenticated USING ((SELECT auth.uid())=owner_id AND status='active') WITH CHECK ((SELECT auth.uid())=owner_id AND status='active');
CREATE POLICY "teacher sessions insert own or free lesson" ON public.mika_teacher_sessions FOR INSERT TO authenticated WITH CHECK (
 (SELECT auth.uid())=owner_id AND (journey_id IS NULL OR EXISTS(
 SELECT 1 FROM public.myryra_journeys j WHERE j.id=journey_id AND j.owner_id=(SELECT auth.uid()) AND j.status='active'
 )));
CREATE POLICY "teacher messages select own" ON public.mika_teacher_messages FOR SELECT TO authenticated USING ((SELECT auth.uid())=owner_id);
REVOKE ALL ON public.myryra_journeys, public.mika_teacher_sessions, public.mika_teacher_messages FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.myryra_journeys,public.mika_teacher_sessions TO authenticated;
GRANT SELECT ON public.mika_teacher_messages TO authenticated;
COMMIT;
