-- MIKA Professora: allow trusted server-side chat persistence only.
-- Browser users retain SELECT-only access protected by owner-scoped RLS.
-- The API validates the authenticated owner before writing assistant/user messages.
GRANT INSERT ON TABLE public.mika_teacher_messages TO service_role;
