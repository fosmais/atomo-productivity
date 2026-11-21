-- MYRYRA MVP2: read-only database baseline readiness check.
-- Run independently against production and isolated homologation; compare outputs.
-- No customer records, tokens, or secrets are selected.
SELECT current_database() AS database_name,
       count(*) FILTER (WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS public_tables
FROM information_schema.tables;

WITH required(name) AS (
  VALUES ('events'), ('tasks'), ('plans'), ('myryra_finance_entries'),
         ('myryra_journeys'), ('mika_teacher_sessions'),
         ('support_tickets'), ('support_email_outbox')
)
SELECT required.name AS required_table,
       to_regclass(format('public.%I', required.name)) IS NOT NULL AS exists_in_public
FROM required ORDER BY required.name;

SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- Explicit release gate: all eight required tables must exist and have RLS enabled.
-- This returns readiness=false in a partial support-only database.
WITH required(name) AS (
  VALUES ('events'), ('tasks'), ('plans'), ('myryra_finance_entries'),
         ('myryra_journeys'), ('mika_teacher_sessions'),
         ('support_tickets'), ('support_email_outbox')
), checks AS (
  SELECT required.name,
         c.oid IS NOT NULL AS table_exists,
         COALESCE(c.relrowsecurity, false) AS rls_enabled
  FROM required
  LEFT JOIN pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_class c ON c.relnamespace = n.oid
                      AND c.relname = required.name AND c.relkind = 'r'
)
SELECT bool_and(table_exists AND rls_enabled) AS schema_rls_ready,
       count(*) FILTER (WHERE table_exists AND rls_enabled) AS passed,
       count(*) AS required,
       string_agg(name, ', ' ORDER BY name)
         FILTER (WHERE NOT (table_exists AND rls_enabled)) AS missing_or_unprotected
FROM checks;

-- Support automation release gate (read-only).
-- Safe to run against production and homologation independently.
WITH checks AS (
  SELECT
    to_regprocedure('public.create_support_ticket_limited(uuid,text,text,text,boolean)') AS ticket_rpc,
    to_regclass('public.support_tickets') AS tickets,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'support_email_outbox'
        AND column_name = 'processing_started_at'
    ) AS outbox_lease_column,
    EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = to_regclass('public.support_email_outbox')
        AND conname = 'support_email_outbox_event_type_check'
        AND pg_get_constraintdef(oid) LIKE '%ticket_acknowledgement%'
    ) AS acknowledgement_supported,
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'support_tickets'
        AND cmd = 'INSERT' AND 'authenticated' = ANY(roles)
    ) AS direct_insert_policy_absent
)
SELECT ticket_rpc IS NOT NULL AS ticket_rpc_exists,
       COALESCE(has_function_privilege('authenticated', ticket_rpc, 'EXECUTE'), false) = false
         AS authenticated_rpc_blocked,
       COALESCE(has_function_privilege('service_role', ticket_rpc, 'EXECUTE'), false)
         AS service_role_rpc_allowed,
       COALESCE(has_table_privilege('authenticated', tickets, 'INSERT'), false) = false
         AS direct_insert_grant_blocked,
       direct_insert_policy_absent,
       outbox_lease_column,
       acknowledgement_supported,
       ticket_rpc IS NOT NULL
         AND COALESCE(has_function_privilege('authenticated', ticket_rpc, 'EXECUTE'), false) = false
         AND COALESCE(has_function_privilege('service_role', ticket_rpc, 'EXECUTE'), false)
         AND COALESCE(has_table_privilege('authenticated', tickets, 'INSERT'), false) = false
         AND direct_insert_policy_absent
         AND outbox_lease_column
         AND acknowledgement_supported AS support_release_ready
FROM checks;

-- Diagnóstico confirmado em 2026-11-21: branch de suporte falhou ao aplicar
-- autopilot_unique_task_reservation_guard porque public.events não existia.
-- Log PostgreSQL: relation "public.events" does not exist, durante CREATE UNIQUE INDEX
-- events_autopilot_task_once_per_user_idx ON public.events (user_id, notes).
-- A correção exige uma migração de baseline que crie events e suas dependências
-- ANTES de 20261030195840. Não marcar migrações como aplicadas sem executar DDL.
-- Não executar reset nem copiar dados de produção para homologação.
SELECT to_regclass('public.events') IS NOT NULL AS events_baseline_present,
       EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
               AND indexname='events_autopilot_task_once_per_user_idx') AS autopilot_guard_present;

-- Calendar concurrency safety gate: requires the real overlap trigger/function.
-- A table-only baseline is not sufficient for scheduling homologation.
SELECT EXISTS (
  SELECT 1 FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'events'
    AND t.tgname = 'myryra_guard_blocking_event_overlap'
    AND NOT t.tgisinternal AND t.tgenabled IN ('O','A')
    AND pg_get_triggerdef(t.oid) LIKE '%BEFORE INSERT OR UPDATE%'
) AS overlap_trigger_active,
to_regprocedure('public.myryra_guard_blocking_event_overlap()') IS NOT NULL AS overlap_function_exists,
EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'myryra_guard_blocking_event_overlap'
    AND pg_get_functiondef(p.oid) LIKE '%pg_advisory_xact_lock%'
    AND pg_get_functiondef(p.oid) LIKE '%23P01%'
) AS overlap_concurrency_guard_present;

-- Detect permissive RLS UPDATE policies that overlap on soft-deleted events.
-- This is a review flag, not proof of cross-user access or an instruction to
-- remove legitimate restoration support.
SELECT count(*) FILTER (WHERE cmd = 'UPDATE') AS event_update_policies,
       bool_or(cmd = 'UPDATE' AND policyname = 'Users can update own events') AS broad_owner_update_exists,
       bool_or(cmd = 'UPDATE' AND policyname = 'events_owner_update_category') AS category_update_exists
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'events';
