-- Issue #61: synthetic idempotence and duplicate-credit rehearsal.
-- TEMP tables only, transaction rolled back; not a real migration or trigger E2E.
BEGIN;
CREATE TEMP TABLE myra_rehearsal_missions(id uuid PRIMARY KEY) ON COMMIT DROP;
CREATE TEMP TABLE myra_rehearsal_ledger(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mission_id uuid NULL REFERENCES myra_rehearsal_missions(id) ON DELETE SET NULL,
 source_mission_id uuid NOT NULL UNIQUE,
 amount integer NOT NULL DEFAULT 10 CHECK (amount = 10)
) ON COMMIT DROP;
INSERT INTO myra_rehearsal_missions(id) VALUES
 ('00000000-0000-4000-8000-000000000211'),
 ('00000000-0000-4000-8000-000000000212');
INSERT INTO myra_rehearsal_ledger(mission_id,source_mission_id) VALUES
 ('00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000211');
-- A retry of the same completion must not credit twice.
INSERT INTO myra_rehearsal_ledger(mission_id,source_mission_id) VALUES
 ('00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000211')
ON CONFLICT (source_mission_id) DO NOTHING;
DO $$
BEGIN
 IF (SELECT count(*) FROM myra_rehearsal_ledger) <> 1 THEN
   RAISE EXCEPTION 'Duplicate MYRA credit on retry';
 END IF;
END $$;
-- Parent deletion nulls the active FK but retains the immutable source key.
DELETE FROM myra_rehearsal_missions WHERE id='00000000-0000-4000-8000-000000000211';
INSERT INTO myra_rehearsal_ledger(mission_id,source_mission_id) VALUES
 (NULL,'00000000-0000-4000-8000-000000000211')
ON CONFLICT (source_mission_id) DO NOTHING;
DO $$
BEGIN
 IF (SELECT count(*) FROM myra_rehearsal_ledger) <> 1
 OR NOT EXISTS (SELECT 1 FROM myra_rehearsal_ledger
   WHERE source_mission_id='00000000-0000-4000-8000-000000000211'
   AND mission_id IS NULL AND amount=10) THEN
   RAISE EXCEPTION 'MYRA history lost or duplicated after parent deletion';
 END IF;
END $$;
-- A distinct completed mission may earn a distinct credit.
INSERT INTO myra_rehearsal_ledger(mission_id,source_mission_id) VALUES
 ('00000000-0000-4000-8000-000000000212','00000000-0000-4000-8000-000000000212');
DO $$
BEGIN
 IF (SELECT count(*) FROM myra_rehearsal_ledger) <> 2
 OR (SELECT sum(amount) FROM myra_rehearsal_ledger) <> 20 THEN
   RAISE EXCEPTION 'Distinct mission credit incorrect';
 END IF;
END $$;
ROLLBACK;
-- Still pending: real trigger, migration ordering, RLS, auth, and PROD-equivalent clone.
