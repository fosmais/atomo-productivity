-- MYRYRA support core schema.
-- Additive and idempotent: production already has these tables, while fresh
-- homologation branches need the same schema before the outbox worker can run.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 160),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 1500),
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general','billing')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  myka_authorized boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.support_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_ticket_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_type text NOT NULL CHECK (author_type IN ('admin','myka')),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  previous_status text,
  new_status text,
  previous_priority text,
  new_priority text,
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.support_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('feedback_created','ticket_created')),
  source_id uuid NOT NULL,
  recipient text NOT NULL DEFAULT 'support@myryra.com',
  subject text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT support_email_outbox_event_type_source_id_key UNIQUE (event_type, source_id)
);

CREATE INDEX IF NOT EXISTS support_tickets_user_created_idx
  ON public.support_tickets(user_id, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_email_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.support_tickets FROM anon;
GRANT SELECT ON public.support_tickets TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.support_tickets FROM authenticated;
DROP POLICY IF EXISTS "Users read own support tickets" ON public.support_tickets;
CREATE POLICY "Users read own support tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users create own support tickets" ON public.support_tickets;
-- Ticket creation is exclusively through the authenticated /api/support/submit route,
-- which enforces input limits and per-user throttling before using service_role.

REVOKE ALL ON public.support_admins FROM anon, authenticated;
REVOKE ALL ON public.support_ticket_replies FROM anon, authenticated;
REVOKE ALL ON public.support_ticket_events FROM anon, authenticated;
REVOKE ALL ON public.support_email_outbox FROM anon, authenticated;
GRANT ALL ON public.support_tickets, public.support_admins, public.support_ticket_replies, public.support_ticket_events, public.support_email_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.support_tickets_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_support_ticket_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid;
BEGIN
  BEGIN
    v_actor := nullif(current_setting('app.support_actor_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_actor := null;
  END;
  IF OLD.status IS DISTINCT FROM NEW.status OR OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO public.support_ticket_events(ticket_id, actor_id, previous_status, new_status, previous_priority, new_priority)
    VALUES (NEW.id, v_actor, OLD.status, NEW.status, OLD.priority, NEW.priority);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS support_ticket_audit ON public.support_tickets;
CREATE TRIGGER support_ticket_audit
  AFTER UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.audit_support_ticket_update();

DROP TRIGGER IF EXISTS support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.support_tickets_touch_updated_at();

CREATE OR REPLACE FUNCTION public.admin_update_support_ticket(
  p_ticket_id uuid,
  p_actor_id uuid,
  p_status text DEFAULT NULL,
  p_priority text DEFAULT NULL
)
RETURNS TABLE(id uuid, status text, priority text, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.support_admins a WHERE a.user_id = p_actor_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized support operator';
  END IF;
  IF p_status IS NULL AND p_priority IS NULL THEN RAISE EXCEPTION 'No changes'; END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('open','in_progress','resolved','closed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  IF p_priority IS NOT NULL AND p_priority NOT IN ('low','normal','high','urgent') THEN
    RAISE EXCEPTION 'Invalid priority';
  END IF;
  PERFORM set_config('app.support_actor_id', p_actor_id::text, true);
  RETURN QUERY
    UPDATE public.support_tickets t
    SET status = coalesce(p_status, t.status),
        priority = coalesce(p_priority, t.priority)
    WHERE t.id = p_ticket_id
    RETURNING t.id, t.status, t.priority, t.updated_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_update_support_ticket(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_support_ticket(uuid,uuid,text,text) TO service_role;
