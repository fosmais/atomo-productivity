-- Read-only security regression for Journey snapshot confirmation RLS.
-- Run against a database that contains public.myryra_journey_snapshot_confirmations.
-- This deliberately fails if any permissive INSERT policy allows an expired snapshot.
-- No user records are read or modified.
BEGIN READ ONLY;
DO $$
DECLARE
  v_count integer;
  v_weak integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename='myryra_journey_snapshot_confirmations'
    AND cmd='INSERT'
    AND permissive='PERMISSIVE';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Missing permissive INSERT policy for snapshot confirmations';
  END IF;

  SELECT count(*) INTO v_weak
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename='myryra_journey_snapshot_confirmations'
    AND cmd='INSERT'
    AND permissive='PERMISSIVE'
    AND (with_check IS NULL OR with_check NOT ILIKE '%expires_at%');
  IF v_weak > 0 THEN
    RAISE EXCEPTION 'Journey RLS regression: % permissive INSERT policy/policies lack snapshot expiration check', v_weak;
  END IF;
END $$;
ROLLBACK;
