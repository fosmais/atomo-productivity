const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261118050000_journey_prevent_physical_delete.sql"), "utf8");
const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/journeys/[journeyId]/route.ts"), "utf8");

test("Issue 58 migration revokes only authenticated Journey DELETE and drops legacy owner delete policy", () => {
  assert.match(migration, /REVOKE\s+DELETE\s+ON\s+TABLE\s+public\.myryra_journeys\s+FROM\s+authenticated\s*;/i);
  assert.match(migration, /DROP\s+POLICY\s+IF\s+EXISTS\s+journeys_delete_owner\s+ON\s+public\.myryra_journeys\s*;/i);
  assert.doesNotMatch(migration, /\b(?:TRUNCATE|DROP\s+TABLE|DELETE\s+FROM|CASCADE)\b/i);
  assert.doesNotMatch(migration, /REVOKE\s+ALL|REVOKE\s+UPDATE/i);
});

test("Journey HTTP DELETE is soft archive, not physical deletion", () => {
  assert.match(route, /export async function DELETE\(request: Request, context: Context\)\s*\{\s*return changeJourney\(request, context, true\)/);
  assert.match(route, /if \(archive\)\s*\{\s*updates\.status = "archived"/);
  assert.match(route, /\.update\(updates\)/);
  assert.match(route, /\.eq\("id", journeyId\)\.eq\("owner_id", user\.id\)/);
  assert.doesNotMatch(route, /\.delete\s*\(/);
  assert.match(route, /Histórico e MYRAs preservados/);
});

test("Journey mutation requires a verified user and rejects archived reactivation", () => {
  const change = route.slice(route.indexOf("async function changeJourney"));
  assert.match(change, /supabase\.auth\.getUser\(\)/);
  assert.match(change, /if \(authError \|\| !user\)/);
  assert.match(change, /\.in\("status", updates\.status === "paused" \? \["active"\] : updates\.status === "active" \? \["paused"\] : archive \? \["active", "paused", "completed"\]/);
});
