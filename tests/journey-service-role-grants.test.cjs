const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/20261121100000_journey_service_role_server_write_grants.sql"),
  "utf8",
);

test("Journey server-write migration grants only the minimum operations to service_role", () => {
  assert.match(migration, /GRANT UPDATE ON TABLE public\.myryra_journeys TO service_role/);
  assert.match(migration, /GRANT UPDATE ON TABLE public\.myryra_journey_missions TO service_role/);
  assert.match(migration, /GRANT INSERT, UPDATE ON TABLE public\.myryra_journey_learning_progress TO service_role/);
  assert.doesNotMatch(migration, /GRANT .* TO (PUBLIC|anon|authenticated)/i);
  const executable = migration.split("\n").filter(line => !/^\s*--/.test(line)).join("\n");
  assert.doesNotMatch(executable, /GRANT DELETE|GRANT ALL|GRANT TRUNCATE/i);
});

test("Journey server-write migration fails closed when a required table or role is missing", () => {
  assert.match(migration, /to_regclass\('public\.myryra_journeys'\) IS NULL/);
  assert.match(migration, /to_regclass\('public\.myryra_journey_missions'\) IS NULL/);
  assert.match(migration, /to_regclass\('public\.myryra_journey_learning_progress'\) IS NULL/);
  assert.match(migration, /rolname = 'service_role'/);
  assert.match(migration, /RAISE EXCEPTION/);
});

test("Journey server-write migration never grants physical deletion or ledger mutation", () => {
  assert.doesNotMatch(migration, /myryra_journey_myra_ledger/i);
  assert.doesNotMatch(migration, /GRANT DELETE/i);
  assert.doesNotMatch(migration, /GRANT INSERT, UPDATE, DELETE/i);
});
