const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (relative) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

test("teacher session creation validates mission ownership and keeps mission optional", () => {
  const src = read("src/app/api/mika/lessons/sessions/route.ts");
  assert.match(src, /body\.missionId !== undefined/);
  assert.match(src, /\.eq\("journey_id", journey\.id\)/);
  assert.match(src, /mission_id: body\.missionId/);
});

test("MIKA feedback rejects sessions not linked to the assessed mission", () => {
  const src = read("src/app/api/journeys/feedback/route.ts");
  assert.match(src, /\.eq\("owner_id", user\.id\)/);
  assert.match(src, /\.eq\("journey_id", journeyId\)\.eq\("mission_id", missionId\)/);
  assert.match(src, /Aula não vinculada a esta missão/);
});

test("mission completion preserves legacy learning gate and checks explicit policy", () => {
  const src = read("src/app/api/journeys/[journeyId]/missions/[missionId]/route.ts");
  assert.match(src, /educationalMission\.test\(missionDetails\.title\) \|\| policy\?\.requires_assessment === true/);
  assert.match(src, /learning\.assessment_passed !== true/);
  assert.match(src, /learning\.assessment_score < minimumScore/);
});

test("database rejects cross-owner links and denies client policy writes", () => {
  const sql = read("supabase/migrations/20261114000100_mika_teacher_mission_link.sql");
  assert.match(sql, /mika_teacher_validate_mission_link/);
  assert.match(sql, /myryra_validate_assessment_policy_owner/);
  assert.match(sql, /revoke all on public\.myryra_journey_mission_assessment_policy from public, anon, authenticated/);
  assert.match(sql, /grant select on public\.myryra_journey_mission_assessment_policy to authenticated/);
});
