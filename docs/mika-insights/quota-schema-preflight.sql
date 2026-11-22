-- MIKA Insights: read-only preflight for quota schema compatibility.
-- Safe for staging and Production. No DDL or DML.
WITH columns AS (
  SELECT
    bool_or(column_name = 'requests') AS has_requests,
    bool_or(column_name = 'usage_count') AS has_usage_count,
    bool_or(column_name = 'window_start') AS has_window_start
  FROM information_schema.columns
  WHERE table_schema = 'mika_internal' AND table_name = 'ai_quota'
), primary_key AS (
  SELECT string_agg(a.attname, ', ' ORDER BY k.ordinality) AS key_columns
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ordinality) ON true
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
  WHERE n.nspname = 'mika_internal' AND t.relname = 'ai_quota' AND c.contype = 'p'
), rpc AS (
  SELECT p.prosecdef AS security_definer,
         pg_get_functiondef(p.oid) LIKE '%usage_count%' AS uses_usage_count,
         pg_get_functiondef(p.oid) LIKE '%requests%' AS uses_requests
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'mika_consume_ai_quota'
)
SELECT columns.*, primary_key.key_columns,
       rpc.security_definer, rpc.uses_usage_count, rpc.uses_requests,
       NOT has_function_privilege('anon','public.mika_consume_ai_quota(text)','EXECUTE') AS anon_denied
FROM columns CROSS JOIN primary_key CROSS JOIN rpc;
-- Separately, after verifying table exists:
SELECT count(*) AS quota_rows, count(DISTINCT user_id) AS users_with_quota
FROM mika_internal.ai_quota;
