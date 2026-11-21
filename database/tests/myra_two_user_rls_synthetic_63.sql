-- Disposable PostgreSQL two-user authorization rehearsal; no Supabase credentials.
BEGIN;
CREATE ROLE myra_test_a NOLOGIN;
CREATE ROLE myra_test_b NOLOGIN;
CREATE SCHEMA myra_two_user;
GRANT USAGE ON SCHEMA myra_two_user TO myra_test_a,myra_test_b;
CREATE TABLE myra_two_user.journeys(id integer PRIMARY KEY, owner_name name NOT NULL);
CREATE TABLE myra_two_user.missions(id integer PRIMARY KEY, journey_id integer REFERENCES myra_two_user.journeys(id),status text NOT NULL DEFAULT 'pending',requires_assessment boolean NOT NULL DEFAULT true,assessment_passed boolean NOT NULL DEFAULT false);
CREATE TABLE myra_two_user.ledger(mission_id integer PRIMARY KEY,owner_name name NOT NULL,amount integer NOT NULL DEFAULT 10);
INSERT INTO myra_two_user.journeys VALUES (1,'myra_test_a'),(2,'myra_test_b');
INSERT INTO myra_two_user.missions(id,journey_id) VALUES (11,1),(22,2);
ALTER TABLE myra_two_user.journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE myra_two_user.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE myra_two_user.ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_journeys ON myra_two_user.journeys FOR SELECT USING(owner_name=current_user);
CREATE POLICY owner_missions_select ON myra_two_user.missions FOR SELECT USING(EXISTS(SELECT 1 FROM myra_two_user.journeys j WHERE j.id=journey_id AND j.owner_name=current_user));
CREATE POLICY owner_missions_update ON myra_two_user.missions FOR UPDATE USING(EXISTS(SELECT 1 FROM myra_two_user.journeys j WHERE j.id=journey_id AND j.owner_name=current_user)) WITH CHECK(EXISTS(SELECT 1 FROM myra_two_user.journeys j WHERE j.id=journey_id AND j.owner_name=current_user));
CREATE POLICY owner_ledger ON myra_two_user.ledger FOR SELECT USING(owner_name=current_user);
GRANT SELECT ON myra_two_user.journeys,myra_two_user.missions,myra_two_user.ledger TO myra_test_a,myra_test_b;
GRANT UPDATE(status,journey_id) ON myra_two_user.missions TO myra_test_a,myra_test_b;
CREATE FUNCTION myra_two_user.enforce_assessment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.requires_assessment AND NOT NEW.assessment_passed
 THEN RAISE EXCEPTION 'assessment required' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assessment_guard BEFORE UPDATE OF status ON myra_two_user.missions FOR EACH ROW EXECUTE FUNCTION myra_two_user.enforce_assessment();
CREATE FUNCTION myra_two_user.issue_credit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
 INSERT INTO myra_two_user.ledger(mission_id,owner_name)
 SELECT NEW.id,j.owner_name FROM myra_two_user.journeys j WHERE j.id=NEW.journey_id
 ON CONFLICT(mission_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER credit AFTER UPDATE OF status ON myra_two_user.missions FOR EACH ROW EXECUTE FUNCTION myra_two_user.issue_credit();
SET ROLE myra_test_a;
DO $$
DECLARE changed integer;
BEGIN
 IF (SELECT count(*) FROM myra_two_user.journeys)<>1 THEN RAISE EXCEPTION 'cross-owner journey read'; END IF;
 IF (SELECT count(*) FROM myra_two_user.missions)<>1 THEN RAISE EXCEPTION 'cross-owner mission read'; END IF;
 UPDATE myra_two_user.missions SET status='completed' WHERE id=22;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'cross-owner update succeeded'; END IF;
 -- An owner must not be able to move their mission under another owner's journey.
 BEGIN
  UPDATE myra_two_user.missions SET journey_id=2 WHERE id=11;
  RAISE EXCEPTION 'cross-owner journey reassignment succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF (SELECT count(*) FROM myra_two_user.missions WHERE id=11 AND journey_id=1)<>1 THEN
  RAISE EXCEPTION 'mission ownership changed'; END IF;
 BEGIN
  UPDATE myra_two_user.missions SET status='completed' WHERE id=11;
  RAISE EXCEPTION 'assessment bypass succeeded';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF (SELECT count(*) FROM myra_two_user.ledger)<>0 THEN RAISE EXCEPTION 'unauthorized credit issued'; END IF;
END $$;
RESET ROLE;
-- Trusted server path records an assessment and completes the owned mission.
UPDATE myra_two_user.missions SET assessment_passed=true WHERE id=11;
SET ROLE myra_test_a;
UPDATE myra_two_user.missions SET status='completed' WHERE id=11;
UPDATE myra_two_user.missions SET status='pending' WHERE id=11;
UPDATE myra_two_user.missions SET status='completed' WHERE id=11;
DO $$
BEGIN
 IF (SELECT count(*) FROM myra_two_user.ledger)<>1 THEN RAISE EXCEPTION 'duplicate or missing MYRA credit'; END IF;
END $$;
RESET ROLE;
SET ROLE myra_test_b;
DO $$
BEGIN
 IF (SELECT count(*) FROM myra_two_user.ledger)<>0 THEN RAISE EXCEPTION 'cross-owner ledger read'; END IF;
 IF (SELECT count(*) FROM myra_two_user.missions)<>1 THEN RAISE EXCEPTION 'cross-owner mission read for B'; END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
 IF (SELECT count(*) FROM myra_two_user.ledger)<>1 OR (SELECT sum(amount) FROM myra_two_user.ledger)<>10 THEN RAISE EXCEPTION 'ledger invariant failed'; END IF;
END $$;
ROLLBACK;
