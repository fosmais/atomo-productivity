-- Staging-only atomic lease claim for finance delivery workers.
-- No external send. Service-role only; concurrent workers use SKIP LOCKED.
CREATE OR REPLACE FUNCTION public.claim_finance_delivery_batch(p_limit integer DEFAULT 50)
RETURNS SETOF public.myryra_finance_delivery_log
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  WITH candidates AS (
    SELECT d.id FROM public.myryra_finance_delivery_log d
    JOIN public.myryra_finance_notifications n
      ON n.id=d.notification_id AND n.user_id=d.user_id
    JOIN public.myryra_finance_alert_preferences p
      ON p.user_id=d.user_id
    WHERE d.status IN ('pending','failed')
      AND d.attempts < 3
      AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= now())
      AND ((d.channel='email' AND p.email_enabled IS TRUE)
        OR (d.channel='push' AND p.push_enabled IS TRUE))
    ORDER BY d.created_at,d.id
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit,1),50)
  )
  UPDATE public.myryra_finance_delivery_log d
  SET status='processing',attempts=d.attempts+1,updated_at=now()
  FROM candidates c
  WHERE d.id=c.id
  RETURNING d.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_finance_delivery_batch(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_finance_delivery_batch(integer) TO service_role;
