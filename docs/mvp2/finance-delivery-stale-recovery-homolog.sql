-- Staging-only recovery for abandoned finance delivery leases.
-- No external sends; stale processing rows return to failed for future claim.
CREATE OR REPLACE FUNCTION public.recover_stale_finance_delivery_batch(
  p_limit integer DEFAULT 50,
  p_stale_minutes integer DEFAULT 15
)
RETURNS TABLE (recovered integer, exhausted integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE='42501';
  END IF;
  IF p_stale_minutes < 5 OR p_stale_minutes > 1440 THEN
    RAISE EXCEPTION 'Invalid lease timeout' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM public.myryra_finance_delivery_log
    WHERE status='processing'
      AND updated_at < now() - make_interval(mins => p_stale_minutes)
    ORDER BY updated_at,id
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit,1),50)
  ), changed AS (
    UPDATE public.myryra_finance_delivery_log d
    SET status='failed',
        next_attempt_at=CASE WHEN d.attempts>=3 THEN NULL ELSE now()+interval '5 minutes' END,
        last_error='Processing lease expired; delivery outcome requires reconciliation',
        updated_at=now()
    FROM candidates c WHERE d.id=c.id
    RETURNING d.attempts
  )
  SELECT count(*)::integer, count(*) FILTER (WHERE attempts>=3)::integer FROM changed;
END;
$$;
REVOKE ALL ON FUNCTION public.recover_stale_finance_delivery_batch(integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recover_stale_finance_delivery_batch(integer,integer) TO service_role;
