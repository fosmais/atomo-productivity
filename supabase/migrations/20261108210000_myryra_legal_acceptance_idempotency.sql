-- Protect the canonical legal acceptance ledger against concurrent submissions.
-- Preflight: abort rather than silently deleting or rewriting existing evidence.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.myryra_privacy_acceptances
    GROUP BY user_id, document_version_id, action
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate legal acceptance evidence exists; review before creating uniqueness index';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS myryra_privacy_acceptances_once_per_action
  ON public.myryra_privacy_acceptances (user_id, document_version_id, action);
