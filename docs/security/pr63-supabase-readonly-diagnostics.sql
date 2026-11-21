-- MYRYRA MVP2 PR #63: read-only Supabase migration/authorization diagnostics.
-- Run separately in PROD and HOMOLOG using a read-only SQL console.
-- This file intentionally contains no DDL, DML, migration repair, or secrets.

SELECT count(*) AS migration_count,
       min(version) AS earliest_migration,
       max(version) AS latest_migration
FROM supabase_migrations.schema_migrations;

SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE name ILIKE '%journey%'
   OR name ILIKE '%myra%'
   OR name ILIKE '%assess%'
   OR name ILIKE '%exercise%'
ORDER BY version;

SELECT to_regclass('public.myryra_journey_assigned_exercises') AS assigned_exercises_table,
       to_regclass('public.myryra_journey_missions') AS missions_table,
       to_regclass('public.myra_ledger') AS myra_ledger_table;

SELECT c.relname AS table_name, t.tgname AS trigger_name,
       pg_get_triggerdef(t.oid, true) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('myryra_journey_missions','myra_ledger')
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

SELECT has_column_privilege('authenticated','public.myryra_journey_missions','status','UPDATE') AS authenticated_can_update_status,
       has_column_privilege('authenticated','public.myryra_journey_missions','journey_id','UPDATE') AS authenticated_can_reassign_journey;

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('myryra_journeys','myryra_journey_missions','myra_ledger','myryra_journey_assigned_exercises')
ORDER BY tablename, policyname;
