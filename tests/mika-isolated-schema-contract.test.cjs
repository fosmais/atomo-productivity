const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const sql = readFileSync(join(process.cwd(), "tests/fixtures/mika-professora-isolated-schema.sql"), "utf8");

test("isolated fixture is explicitly guarded from production usage", () => {
  assert.match(sql, /ISOLATED TEST FIXTURE ONLY/i);
  assert.match(sql, /Never run against the production database/i);
});

test("fixture enables RLS on all three tables", () => {
  for (const name of ["myryra_journeys", "mika_teacher_sessions", "mika_teacher_messages"]) {
    assert.match(sql, new RegExp("ALTER TABLE public\\." + name + " ENABLE ROW LEVEL SECURITY", "i"));
  }
});

test("fixture permits standalone lessons while restricting journey ownership", () => {
  assert.match(sql, /journey_id uuid REFERENCES public\.myryra_journeys/i);
  assert.match(sql, /journey_id IS NULL OR EXISTS/i);
  assert.match(sql, /j\.owner_id=\(SELECT auth\.uid\(\)\)/i);
  assert.match(sql, /j\.status='active'/i);
});

test("fixture binds messages to session owner and denies client writes", () => {
  assert.match(sql, /FOREIGN KEY\(session_id,owner_id\) REFERENCES public\.mika_teacher_sessions\(id,owner_id\)/i);
  assert.match(sql, /CREATE POLICY "teacher messages select own"/i);
  assert.match(sql, /GRANT SELECT ON public\.mika_teacher_messages TO authenticated/i);
  assert.doesNotMatch(sql, /GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)[^;]*ON\s+public\.mika_teacher_messages\s+TO\s+authenticated/i);
});

test("fixture denies anonymous access to sensitive tables", () => {
  assert.match(sql, /REVOKE ALL ON public\.myryra_journeys, public\.mika_teacher_sessions, public\.mika_teacher_messages FROM anon/i);
});
