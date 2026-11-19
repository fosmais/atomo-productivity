// Static guard regression for the Journey mission PATCH endpoint.
// No network, credentials, Supabase mutation or test user required.
// Run: node scripts/test-journey-myra-route-guards.cjs
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const assert = require("node:assert/strict");

const file = join(__dirname, "../src/app/api/journeys/[journeyId]/missions/[missionId]/route.ts");
const source = readFileSync(file, "utf8");

const required = [
  ["authenticated user", /supabase\.auth\.getUser\(\)/],
  ["journey ownership", /\.eq\("owner_id",\s*user\.id\)/],
  ["active journey", /journey\.status\s*!==\s*"active"/],
  ["mission ownership through journey", /\.eq\("journey_id",\s*journeyId\)/],
  ["legal acceptance gate", /hasCurrentLegalAcceptance\(user\.id\)/],
  ["MFA assurance", /getAuthenticatorAssuranceLevel\(\)/],
  ["educational assessment", /assessment_passed/],
  ["server-only update", /createSupabaseAdmin\(\)\.from\("myryra_journey_missions"\)/],
  ["optimistic concurrency predicate", /\.eq\("status",\s*existingMission\.status\)/],
  ["reward readback", /\.from\("myryra_journey_myra_ledger"\)/],
];
for (const [name, pattern] of required) {
  assert.match(source, pattern, "Missing mission route guard: " + name);
}
assert.match(source, /if\s*\(!mission\)\s*return NextResponse\.json\([^\n]*409/, "Missing concurrent-update conflict response");
console.log("Journey MYRA route static guards: PASS (" + (required.length + 1) + " checks)");
console.log("Note: static checks do not prove runtime authorization or concurrency safety.");
