const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const grants = read("database/proposals/pr63_prod_assessment_grants_hardening_REVIEW_ONLY.sql");
const guard = read("database/proposals/pr63_prod_completed_mission_insert_guard_REVIEW_ONLY.sql");

test("P0 permission proposal blocks direct assessment writes and mission status updates", () => {
  assert.match(grants, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public\.myryra_journey_learning_progress\s+FROM PUBLIC, anon, authenticated/i);
  assert.match(grants, /GRANT SELECT ON TABLE public\.myryra_journey_learning_progress TO authenticated/i);
  assert.match(grants, /REVOKE UPDATE ON TABLE public\.myryra_journey_missions FROM PUBLIC, anon, authenticated/i);
});

test("P0 completed-insert proposal blocks credit-triggering completed mission insertion", () => {
  assert.match(guard, /IF NEW\.status = 'completed' THEN/i);
  assert.match(guard, /BEFORE INSERT ON public\.myryra_journey_missions/i);
  assert.match(guard, /ERRCODE = '23514'/i);
});

test("P0 proposals do not delete existing missions or MYRA credits", () => {
  for (const sql of [grants, guard]) {
    const statements = sql.split("\n").filter((line) => !/^\s*--/.test(line)).join("\n");
    assert.doesNotMatch(statements, /\b(?:DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM|UPDATE\s+public\.myryra_journey_myra_ledger)\b/i);
  }
});

test("P0 proposals remain review-only and cannot be mistaken for full assessment guard", () => {
  assert.match(grants, /REVIEW ONLY/);
  assert.match(guard, /REVIEW ONLY/);
  assert.match(grants, /does NOT install a database assessment guard/);
  assert.match(guard, /does not replace the full\s*\n-- assessment check on UPDATE/);
});
