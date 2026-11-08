-- MYRYRA MVP2 staging-only bootstrap candidate.
-- Source: read-only catalog inspection of production schema on 2026-11-08.
-- Never apply to production. Review against historical migrations before replay.
BEGIN;
CREATE TABLE IF NOT EXISTS public.plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 title text NOT NULL,
 source_text text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 title text NOT NULL,
 priority text NOT NULL DEFAULT 'Normal',
 due_date date,
 completed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','waiting','done')),
 duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 5 AND 1440),
 completed_at timestamptz,
 deleted_at timestamptz,
 category text NOT NULL DEFAULT 'personal' CHECK (category IN ('work','family','leisure','health','personal','study'))
);
CREATE TABLE IF NOT EXISTS public.events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
 location text,
 notes text,
 created_at timestamptz NOT NULL DEFAULT now(),
 event_type text NOT NULL DEFAULT 'appointment',
 blocks_time boolean NOT NULL DEFAULT false,
 deleted_at timestamptz,
 category text NOT NULL DEFAULT 'personal' CHECK (category IN ('work','family','leisure','health','personal','study'))
);
CREATE INDEX IF NOT EXISTS events_user_start_idx ON public.events(user_id,starts_at);
CREATE INDEX IF NOT EXISTS events_user_deleted_at_idx ON public.events(user_id,deleted_at);
CREATE INDEX IF NOT EXISTS events_user_category_idx ON public.events(user_id,category,starts_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tasks_user_deleted_at_idx ON public.tasks(user_id,deleted_at);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE op text; tbl text;
BEGIN
 FOR tbl IN SELECT unnest(ARRAY['plans','tasks','events']) LOOP
  FOR op IN SELECT unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) LOOP
   EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'mvp2_bootstrap_'||tbl||'_'||lower(op), tbl);
   IF tbl = 'tasks' THEN
    IF op = 'INSERT' THEN
     EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id AND EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_id AND p.user_id = (select auth.uid())))','mvp2_bootstrap_'||tbl||'_'||lower(op),tbl);
    ELSIF op = 'UPDATE' THEN
     EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id AND EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_id AND p.user_id = (select auth.uid()))) WITH CHECK ((select auth.uid()) = user_id AND EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_id AND p.user_id = (select auth.uid())))','mvp2_bootstrap_'||tbl||'_'||lower(op),tbl);
    ELSE
     EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated USING ((select auth.uid()) = user_id AND EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_id AND p.user_id = (select auth.uid())))','mvp2_bootstrap_'||tbl||'_'||lower(op),tbl,op);
    END IF;
   ELSE
    IF op = 'INSERT' THEN
     EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id)','mvp2_bootstrap_'||tbl||'_'||lower(op),tbl);
    ELSIF op = 'UPDATE' THEN
     EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)','mvp2_bootstrap_'||tbl||'_'||lower(op),tbl);
    ELSE
     EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated USING ((select auth.uid()) = user_id)','mvp2_bootstrap_'||tbl||'_'||lower(op),tbl,op);
    END IF;
   END IF;
  END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON public.plans,public.tasks,public.events FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.plans,public.tasks,public.events TO authenticated;
COMMIT;
