-- Atomically enforce per-user support ticket limits under concurrent requests.
-- Only service_role may invoke this function; user identity comes from the authenticated API route.
-- auth.users FK enforces valid identity; service_role cannot SELECT auth.users directly.
CREATE OR REPLACE FUNCTION public.create_support_ticket_limited(
  p_user_id uuid, p_subject text, p_message text, p_category text, p_authorize_mika boolean DEFAULT false
)
RETURNS TABLE(id uuid, subject text, status text, priority text, created_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $function$
DECLARE
  v_hour_count integer;
  v_day_count integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid user' USING ERRCODE = '22023';
  END IF;
  IF p_subject IS NULL OR char_length(p_subject) NOT BETWEEN 3 AND 160
     OR p_message IS NULL OR char_length(p_message) NOT BETWEEN 10 AND 1500
     OR p_category IS NULL OR p_category NOT IN ('general', 'billing') THEN
    RAISE EXCEPTION 'invalid support ticket' USING ERRCODE = '22023';
  END IF;
  -- Transaction-scoped lock serializes inserts for this user, including across API instances.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 91237));
  SELECT count(*) INTO v_hour_count FROM public.support_tickets t
    WHERE t.user_id = p_user_id AND t.created_at >= now() - interval '1 hour';
  SELECT count(*) INTO v_day_count FROM public.support_tickets t
    WHERE t.user_id = p_user_id AND t.created_at >= now() - interval '24 hours';
  IF v_hour_count >= 5 OR v_day_count >= 10 THEN
    RAISE EXCEPTION 'SUPPORT_RATE_LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY INSERT INTO public.support_tickets
    (user_id, subject, message, category, status, priority, myka_authorized)
    VALUES (p_user_id, p_subject, p_message, p_category, 'open', 'normal',
      COALESCE(p_authorize_mika, false) AND p_category <> 'billing')
    RETURNING support_tickets.id, support_tickets.subject, support_tickets.status,
      support_tickets.priority, support_tickets.created_at;
END;
$function$;

REVOKE ALL ON public.support_tickets FROM anon, authenticated;
GRANT SELECT ON public.support_tickets TO authenticated;

REVOKE ALL ON FUNCTION public.create_support_ticket_limited(uuid,text,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_ticket_limited(uuid,text,text,text,boolean) TO service_role;
