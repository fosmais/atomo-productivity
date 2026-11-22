-- Executable, read-only gate: fail if either Concierge V2 RPC is absent or overprivileged.
DO $gate$
DECLARE
  v_count integer;
  v_bad text[];
BEGIN
  SELECT count(*),
         array_agg(p.proname) FILTER (
           WHERE p.prosecdef
              OR NOT has_function_privilege('service_role', p.oid, 'execute')
              OR has_function_privilege('anon', p.oid, 'execute')
              OR has_function_privilege('authenticated', p.oid, 'execute')
         )
  INTO v_count, v_bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.proname, pg_get_function_identity_arguments(p.oid)) IN (
      ('myka_confirm_event_v2', 'p_message_id uuid, p_user_id uuid, p_acknowledge_conflict boolean'),
      ('myka_cancel_event_v2', 'p_message_id uuid, p_user_id uuid')
    );
  IF v_count <> 2 OR cardinality(coalesce(v_bad, ARRAY[]::text[])) <> 0 THEN
    RAISE EXCEPTION 'MIKA Concierge V2 permissions gate failed: found %, invalid %',
      v_count, coalesce(v_bad, ARRAY[]::text[]);
  END IF;
END
$gate$;
