-- MIKA MVP2 baseline from isolated homologation; additive only.
-- Review migration drift before applying anywhere. No production deployment authorized.
CREATE TABLE IF NOT EXISTS public.mika_action_proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 action_type text NOT NULL CHECK (action_type IN ('create_task','create_event','create_reminder')),
 payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executing','executed','failed','expired')),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
 approved_at timestamptz,
 executed_at timestamptz,
 result jsonb,
 execution_key uuid UNIQUE,
 CONSTRAINT mika_action_proposal_expiry CHECK (expires_at > created_at),
 CONSTRAINT mika_action_proposals_check CHECK (
  jsonb_typeof(payload)='object' AND payload ? 'type' AND payload->>'type'=action_type
  AND jsonb_typeof(payload->'title')='string'
  AND length(btrim(payload->>'title')) BETWEEN 3 AND 160
  AND jsonb_typeof(payload->'reason')='string'
  AND length(payload->>'reason')<=500
  AND payload ? 'due_at'
  AND (payload->'due_at'='null'::jsonb OR jsonb_typeof(payload->'due_at')='string')
 )
);
CREATE UNIQUE INDEX IF NOT EXISTS mika_action_proposals_id_user_idx ON public.mika_action_proposals(id,user_id);
CREATE INDEX IF NOT EXISTS mika_action_proposals_user_created_idx ON public.mika_action_proposals(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS mika_action_proposals_pending_idx ON public.mika_action_proposals(user_id,expires_at) WHERE status='pending';

CREATE TABLE IF NOT EXISTS public.mika_action_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 proposal_id uuid NOT NULL REFERENCES public.mika_action_proposals(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 event_type text NOT NULL CHECK (event_type IN ('proposed','approved','rejected','started','succeeded','failed','expired')),
 created_at timestamptz NOT NULL DEFAULT now(),
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 CONSTRAINT mika_action_audit_owner_fk FOREIGN KEY (proposal_id,user_id)
 REFERENCES public.mika_action_proposals(id,user_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS mika_action_audit_proposal_event_once_idx ON public.mika_action_audit(proposal_id,event_type)
 WHERE event_type IN ('proposed','approved','rejected','started','succeeded','expired');
CREATE INDEX IF NOT EXISTS mika_action_audit_user_idx ON public.mika_action_audit(user_id,created_at DESC);
ALTER TABLE public.mika_action_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mika_action_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mika_action_proposals,public.mika_action_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.mika_action_proposals,public.mika_action_audit TO authenticated;
CREATE POLICY "Users can read own action proposals" ON public.mika_action_proposals FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
CREATE POLICY "Users can read own action audit" ON public.mika_action_audit FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
