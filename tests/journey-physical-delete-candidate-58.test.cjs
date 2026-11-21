const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

const candidate = read("docs/mvp2/sql/journey-prevent-physical-delete-58-CANDIDATE-DO-NOT-APPLY.sql");
const route = read("src/app/api/journeys/[journeyId]/route.ts");

test("Issue 58 remains an unapplied SQL candidate outside migrations", () => {
  assert.match(candidate, /CANDIDATE ONLY\. DO NOT APPLY AUTOMATICALLY/);
  assert.match(candidate, /REVOKE DELETE ON TABLE public\.myryra_journeys FROM authenticated/);
  assert.match(candidate, /DROP POLICY IF EXISTS journeys_delete_owner ON public\.myryra_journeys/);
  assert.doesNotMatch(candidate, /\b(?:TRUNCATE|DROP TABLE|DELETE FROM|CASCADE)\b/i);
});

test("HTTP DELETE archives only an owned journey and preserves MYRA history", () => {
  assert.match(route, /updates\.status = "archived"/);
  assert.match(route, /export async function DELETE\(request: Request, context: Context\) \{ return changeJourney\(request, context, true\); \}/);
  assert.match(route, /createSupabaseAdmin\(\)\.from\("myryra_journeys"\)\.update\(updates\)/);
  assert.match(route, /\.eq\("id", journeyId\)\.eq\("owner_id", user\.id\)/);
  assert.match(route, /Histórico e MYRAs preservados/);
  assert.doesNotMatch(route, /\.delete\s*\(/);
});

test("archive cannot reactivate archived journeys", () => {
  assert.match(route, /archive \? \["active", "paused", "completed"\]/);
  assert.match(route, /supabase\.auth\.getUser\(\)/);
});
