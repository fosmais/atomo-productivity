-- MYRYRA MVP2 Privacy P0. Isolated staging only; not a production migration.
-- Draft schema requires legal approval and server API implementation before launch.
CREATE TABLE IF NOT EXISTS public.myryra_privacy_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL CHECK (document_type IN ('terms','privacy_notice','cookies')),
  version text NOT NULL,
  effective_at timestamptz NOT NULL,
  published_at timestamptz,
  content_hash text NOT NULL,
  public_url text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','published','retired')),
  UNIQUE(document_type,version)
);
CREATE TABLE IF NOT EXISTS public.myryra_privacy_purposes (
  purpose_key text NOT NULL,
  purpose_version integer NOT NULL CHECK (purpose_version > 0),
  display_name text NOT NULL,
  description text NOT NULL,
  legal_basis text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT false,
  PRIMARY KEY(purpose_key,purpose_version)
);
CREATE TABLE IF NOT EXISTS public.myryra_privacy_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_version_id uuid NOT NULL REFERENCES public.myryra_privacy_document_versions(id),
  action text NOT NULL CHECK (action IN ('accepted','acknowledged')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  evidence_source text NOT NULL,
  ui_locale text NOT NULL DEFAULT 'pt-BR',
  request_id uuid NOT NULL,
  UNIQUE(user_id,request_id)
);
CREATE INDEX IF NOT EXISTS myryra_privacy_acceptances_owner_idx ON public.myryra_privacy_acceptances(user_id,occurred_at DESC);
CREATE TABLE IF NOT EXISTS public.myryra_privacy_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose_key text NOT NULL,
  purpose_version integer NOT NULL,
  granted boolean NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  notice_version_id uuid REFERENCES public.myryra_privacy_document_versions(id),
  request_id uuid NOT NULL,
  FOREIGN KEY(purpose_key,purpose_version) REFERENCES public.myryra_privacy_purposes(purpose_key,purpose_version),
  UNIQUE(user_id,request_id)
);
CREATE INDEX IF NOT EXISTS myryra_privacy_choices_owner_idx ON public.myryra_privacy_choices(user_id,purpose_key,occurred_at DESC);
CREATE TABLE IF NOT EXISTS public.myryra_privacy_rights_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('access','correction','export','deletion','other')),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','verifying','processing','completed','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  resolution_note text
);
CREATE INDEX IF NOT EXISTS myryra_privacy_rights_owner_idx ON public.myryra_privacy_rights_requests(user_id,created_at DESC);
ALTER TABLE public.myryra_privacy_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.myryra_privacy_purposes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.myryra_privacy_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.myryra_privacy_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.myryra_privacy_rights_requests ENABLE ROW LEVEL SECURITY;
-- No direct client write permissions to immutable acceptance and choice audit trails.
REVOKE ALL ON public.myryra_privacy_document_versions,public.myryra_privacy_purposes,public.myryra_privacy_acceptances,public.myryra_privacy_choices,public.myryra_privacy_rights_requests FROM anon,authenticated,PUBLIC;
GRANT SELECT ON public.myryra_privacy_document_versions,public.myryra_privacy_purposes TO authenticated;
GRANT SELECT ON public.myryra_privacy_acceptances,public.myryra_privacy_choices,public.myryra_privacy_rights_requests TO authenticated;
CREATE POLICY privacy_published_documents_read ON public.myryra_privacy_document_versions FOR SELECT TO authenticated USING(status='published');
CREATE POLICY privacy_active_purposes_read ON public.myryra_privacy_purposes FOR SELECT TO authenticated USING(active);
CREATE POLICY privacy_acceptances_owner_read ON public.myryra_privacy_acceptances FOR SELECT TO authenticated USING((SELECT auth.uid())=user_id);
CREATE POLICY privacy_choices_owner_read ON public.myryra_privacy_choices FOR SELECT TO authenticated USING((SELECT auth.uid())=user_id);
CREATE POLICY privacy_requests_owner_read ON public.myryra_privacy_rights_requests FOR SELECT TO authenticated USING((SELECT auth.uid())=user_id);
-- Service-only writes must be implemented through verified backend APIs.
