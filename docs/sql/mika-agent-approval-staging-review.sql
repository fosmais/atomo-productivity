-- MIKA approval RPC: staging review only; do not apply to production.
-- Requires docs/sql/mika-agent-baseline-schema-review.sql.
-- Approval and audit insert share a single PostgreSQL transaction.
CREATE OR REPLACE FUNCTION public.mika_approve_task_proposal(p_proposal_id uuid)
RETURNS TABLE(approval_status text, proposal_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  p public.mika_action_proposals%rowtype;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE='28000';
  END IF;
  SELECT * INTO p FROM public.mika_action_proposals
  WHERE id=p_proposal_id AND user_id=v_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'proposal_not_found' USING ERRCODE='P0002';
  END IF;
  IF p.action_type <> 'create_task' THEN
    RAISE EXCEPTION 'unsupported_action' USING ERRCODE='P0001';
  END IF;
  IF p.status='approved' THEN
    IF p.approved_at IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.mika_action_audit a
      WHERE a.proposal_id=p.id AND a.user_id=v_user AND a.event_type='approved'
    ) THEN
      RAISE EXCEPTION 'inconsistent_approval' USING ERRCODE='P0001';
    END IF;
    RETURN QUERY SELECT 'already_approved'::text,p.id;
    RETURN;
  END IF;
  IF p.status <> 'pending' THEN
    RAISE EXCEPTION 'proposal_not_pending' USING ERRCODE='P0001';
  END IF;
  IF p.expires_at <= now() THEN
    UPDATE public.mika_action_proposals SET status='expired' WHERE id=p.id;
    INSERT INTO public.mika_action_audit(proposal_id,user_id,event_type)
    VALUES(p.id,v_user,'expired');
    RETURN QUERY SELECT 'expired'::text,p.id;
    RETURN;
  END IF;
  UPDATE public.mika_action_proposals
  SET status='approved', approved_at=now() WHERE id=p.id;
  INSERT INTO public.mika_action_audit(proposal_id,user_id,event_type)
  VALUES(p.id,v_user,'approved');
  RETURN QUERY SELECT 'approved'::text,p.id;
END
$function$;

REVOKE ALL ON FUNCTION public.mika_approve_task_proposal(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.mika_approve_task_proposal(uuid) TO authenticated;
