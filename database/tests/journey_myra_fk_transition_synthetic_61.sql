-- Issue #61: isolated synthetic rehearsal of the FK transition CASCADE -> SET NULL.
-- Safe to execute in a disposable SQL session: only pg_temp tables are created;
-- the outer transaction is rolled back. Does NOT alter application tables.
BEGIN;
CREATE TEMP TABLE rehearsal_journeys (id uuid PRIMARY KEY) ON COMMIT DROP;
CREATE TEMP TABLE rehearsal_missions (
  id uuid PRIMARY KEY,
  journey_id uuid NOT NULL REFERENCES rehearsal_journeys(id) ON DELETE CASCADE
) ON COMMIT DROP;
CREATE TEMP TABLE rehearsal_ledger (
  id uuid PRIMARY KEY,
  journey_id uuid NOT NULL REFERENCES rehearsal_journeys(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES rehearsal_missions(id) ON DELETE CASCADE
) ON COMMIT DROP;

INSERT INTO rehearsal_journeys VALUES ('00000000-0000-4000-8000-000000000101');
INSERT INTO rehearsal_missions VALUES
 ('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000101');
INSERT INTO rehearsal_ledger VALUES
 ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201');

-- Model the intended migration without touching real MYRA tables.
ALTER TABLE rehearsal_ledger ADD COLUMN source_mission_id uuid;
UPDATE rehearsal_ledger SET source_mission_id = mission_id;
ALTER TABLE rehearsal_ledger
 ALTER COLUMN source_mission_id SET NOT NULL,
 ADD CONSTRAINT rehearsal_source_mission_unique UNIQUE (source_mission_id),
 ALTER COLUMN journey_id DROP NOT NULL,
 ALTER COLUMN mission_id DROP NOT NULL;
ALTER TABLE rehearsal_ledger DROP CONSTRAINT rehearsal_ledger_journey_id_fkey;
ALTER TABLE rehearsal_ledger DROP CONSTRAINT rehearsal_ledger_mission_id_fkey;
ALTER TABLE rehearsal_ledger ADD CONSTRAINT rehearsal_ledger_journey_id_fkey
 FOREIGN KEY (journey_id) REFERENCES rehearsal_journeys(id) ON DELETE SET NULL;
ALTER TABLE rehearsal_ledger ADD CONSTRAINT rehearsal_ledger_mission_id_fkey
 FOREIGN KEY (mission_id) REFERENCES rehearsal_missions(id) ON DELETE SET NULL;

-- Archive should not remove any credit.
UPDATE rehearsal_journeys SET id=id;
DO $$
BEGIN
 IF (SELECT count(*) FROM rehearsal_ledger) <> 1 THEN
   RAISE EXCEPTION 'Ledger credit missing before deletion rehearsal';
 END IF;
END $$;

-- Simulate legacy physical deletion to verify that credits survive the FK change.
DELETE FROM rehearsal_journeys WHERE id='00000000-0000-4000-8000-000000000101';
DO $$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM rehearsal_ledger
   WHERE id='00000000-0000-4000-8000-000000000301'
     AND source_mission_id='00000000-0000-4000-8000-000000000201'
     AND journey_id IS NULL AND mission_id IS NULL
 ) THEN
   RAISE EXCEPTION 'Credit was not preserved after synthetic parent deletion';
 END IF;
END $$;
ROLLBACK;

-- This test does not validate PROD migrations, RLS, Auth, triggers, real data,
-- client compatibility, or the separately required protection against DELETE.
