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
