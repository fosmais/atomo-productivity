-- Security hotfix: remove redundant permissive INSERT policy that lacks expiry guard.
-- Retained policy journey_snapshot_confirmation_insert_own enforces owner,
-- ownership of snapshot and journey, and snapshot expires_at > now().
-- The existing SELECT policies and snapshot-confirmation RPC are unchanged.
BEGIN;
DROP POLICY IF EXISTS journey_snapshot_confirmation_owner_insert
  ON public.myryra_journey_snapshot_confirmations;
DO $$
DECLARE weak_count integer; strict_count integer;
BEGIN
  SELECT count(*) FILTER (WHERE with_check IS NULL OR with_check NOT ILIKE '%expires_at%'),
         count(*) FILTER (WHERE policyname = 'journey_snapshot_confirmation_insert_own')
  INTO weak_count, strict_count
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename='myryra_journey_snapshot_confirmations'
    AND cmd='INSERT' AND permissive='PERMISSIVE';
  IF weak_count <> 0 OR strict_count <> 1 THEN
    RAISE EXCEPTION 'Journey snapshot RLS guard verification failed';
  END IF;
END $$;
COMMIT;
