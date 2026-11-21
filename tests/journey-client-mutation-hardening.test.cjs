const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/20261121034639_journey_client_mutation_hardening.sql"),
  "utf8",
);
const grants = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/20261121034552_journey_service_role_server_write_grants.sql"),
  "utf8",
);

test("Journey direct client status, delete and assessment writes are revoked", () => {
  assert.match(migration, /REVOKE UPDATE, DELETE ON TABLE public\.myryra_journeys FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE UPDATE, DELETE ON TABLE public\.myryra_journey_missions FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.myryra_journey_learning_progress FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT SELECT ON TABLE public\.myryra_journey_learning_progress TO authenticated/);
});

test("Journey physical-delete policies are removed while archive remains server-side", () => {
  assert.match(migration, /DROP POLICY IF EXISTS journeys_delete_owner ON public\.myryra_journeys/);
  assert.match(migration, /DROP POLICY IF EXISTS missions_delete_owner ON public\.myryra_journey_missions/);
  const route = fs.readFileSync(path.join(__dirname, "../src/app/api/journeys/[journeyId]/route.ts"), "utf8");
  assert.match(route, /updates\.status = "archived"/);
  assert.match(route, /const admin = createSupabaseAdmin\(\)/);\n  assert.match(route, /admin\.from\("myryra_journeys"\)\.update\(updates\)/);
  assert.doesNotMatch(route, /\.delete\s*\(/);
});

test("Trusted server has only the write operations required by Journey routes", () => {
  assert.match(grants, /GRANT UPDATE ON TABLE public\.myryra_journeys TO service_role/);
  assert.match(grants, /GRANT UPDATE ON TABLE public\.myryra_journey_missions TO service_role/);
  assert.match(grants, /GRANT INSERT, UPDATE ON TABLE public\.myryra_journey_learning_progress TO service_role/);
  const executableGrants = grants.split("\n").filter(line => !/^\s*--/.test(line)).join("\n");
  assert.doesNotMatch(executableGrants, /GRANT DELETE|GRANT ALL|GRANT TRUNCATE/i);
});
