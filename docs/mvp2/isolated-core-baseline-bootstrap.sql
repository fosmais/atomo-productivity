-- MYRYRA MVP2: isolated homologation baseline bootstrap (NOT a production migration).
-- Reconstructed from read-only production catalog inspection, 2026-11-21.
-- Run only on a disposable isolated Supabase branch after reviewing historical migrations.
-- This establishes core owner-scoped tables; it does NOT replace the full schema history.
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
  status text NOT NULL DEFAULT 'todo',
  duration_minutes integer,
  completed_at timestamptz,
  deleted_at timestamptz,
  category text NOT NULL DEFAULT 'personal'
);
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  location text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL DEFAULT 'appointment',
  blocks_time boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  category text NOT NULL DEFAULT 'personal',
  CONSTRAINT events_valid_period CHECK (ends_at > starts_at),
  CONSTRAINT events_title_length CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT events_category_check CHECK (category IN ('work','family','leisure','health','personal','study'))
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
-- Policies are deliberately restrictive: no public/anonymous access.
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['plans','tasks','events'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)', tbl || '_owner_only_bootstrap', tbl);
  END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS events_user_start_idx ON public.events(user_id, starts_at);
CREATE INDEX IF NOT EXISTS tasks_user_id_bootstrap_idx ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS plans_user_id_bootstrap_idx ON public.plans(user_id);
COMMIT;
-- Important: other original migrations may add constraints, grants, indexes, and columns.
-- Do not mark missing migrations as applied, and do not deploy this bootstrap to PROD.
