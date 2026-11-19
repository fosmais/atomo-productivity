-- PR #62: MYRA ledger production preflight, READ ONLY.
-- Run each SELECT separately if SQL interface returns only one result set.
-- Do not run migrations or any data-changing statements as part of this preflight.

-- 1. Baseline counts and balance.
SELECT count(*) AS credits, coalesce(sum(amount),0) AS total_myra,
       count(DISTINCT mission_id) AS distinct_missions,
       count(*) FILTER (WHERE mission_id IS NULL) AS null_missions,
       count(*) FILTER (WHERE journey_id IS NULL) AS null_journeys
FROM public.myryra_journey_myra_ledger;

-- 2. Duplicate source candidates: must be zero before UNIQUE backfill.
SELECT count(*) AS duplicate_mission_groups
FROM (
  SELECT mission_id FROM public.myryra_journey_myra_ledger
  WHERE mission_id IS NOT NULL
  GROUP BY mission_id HAVING count(*) > 1
) AS duplicates;

-- 3. Check existing column names/nullability before any ALTER.
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='myryra_journey_myra_ledger'
ORDER BY ordinal_position;

-- 4. Existing FK behavior, including account deletion.
SELECT conname, confdeltype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype='f' AND conrelid='public.myryra_journey_myra_ledger'::regclass
ORDER BY conname;

-- 5. Current RLS and grants; grants alone do not establish row access.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('myryra_journeys','myryra_journey_myra_ledger')
ORDER BY tablename,policyname;

-- 6. Trigger function security and EXECUTE privileges.
SELECT p.proname, pg_get_userbyid(p.proowner) AS function_owner,
       p.prosecdef AS security_definer, p.proconfig,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='myryra_credit_completed_mission';

-- 7. Relevant triggers and definitions.
SELECT c.relname AS table_name, t.tgname AS trigger_name,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('myryra_journey_missions','myryra_journey_myra_ledger')
  AND NOT t.tgisinternal
ORDER BY c.relname,t.tgname;
