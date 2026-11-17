const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/journeys/[journeyId]/route.ts"), "utf8");

test("Journey PATCH and archive writes use a privileged server client after ownership verification", () => {
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /\.eq\("id", journeyId\)\.eq\("owner_id", user\.id\)\.maybeSingle\(\)/);
  assert.match(route, /hasCurrentLegalAcceptance\(user\.id\)/);
  assert.match(route, /createSupabaseAdmin\(\)\.from\("myryra_journeys"\)\.update\(updates\)/);
  assert.match(route, /\.eq\("id", journeyId\)\.eq\("owner_id", user\.id\)/);
  assert.doesNotMatch(route, /await supabase\.from\("myryra_journeys"\)\.update\(updates\)/);
});

test("Journey route limits mutation fields and archive remains a soft delete", () => {
  assert.match(route, /updates\.status = "archived"/);
  assert.match(route, /updates\.status = data\.status/);
  assert.match(route, /updates\.title = data\.title\.trim\(\)/);
  assert.match(route, /updates\.target_date = data\.targetDate/);
  assert.match(route, /export async function DELETE/);
});
