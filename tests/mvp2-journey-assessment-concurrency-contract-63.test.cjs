const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("feedback uses revision compare-and-set after AI response", () => {
  const route = source("src/app/api/journeys/feedback/route.ts");
  assert.match(route, /currentProgress\?\.answer !== priorProgress\?\.answer/);
  assert.match(route, /latestAssignment\?\.id \?\? null\) !== assessedExerciseId/);
  assert.match(route, /\.eq\("answer", priorProgress!\.answer\)/);
  assert.match(route, /\.eq\("updated_at", priorProgress!\.updated_at\)/);
  assert.match(route, /\.eq\("assessment_attempts", priorProgress\?\.assessment_attempts \?\? 0\)/);
  assert.match(route, /if \(!savedRows\?\.length\)/);
});

test("editing a saved answer invalidates its previous grade", () => {
  const route = source("src/app/api/journeys/learning/route.ts");
  assert.match(route, /if \(previous\.answer === answer\)/);
  assert.match(route, /feedback: null, assessed_exercise_id: null, assessment_score: null, assessment_passed: null/);
  assert.match(route, /\.eq\("answer", previous\.answer\)\.eq\("updated_at", previous\.updated_at\)/);
  assert.match(route, /if \(!updated\?\.length\)/);
});

test("mission completion is conditional and requires stored passing assessment", () => {
  const route = source("src/app/api/journeys/[journeyId]/missions/[missionId]/route.ts");
  assert.match(route, /learning\.assessment_passed !== true/);
  assert.match(route, /learning\.assessment_score < minimumScore/);
  assert.match(route, /\.eq\("id", missionId\)\.eq\("journey_id", journeyId\)\.eq\("status", existingMission\.status\)/);
  assert.match(route, /updateError\?\.code === "23514"/);
  assert.match(route, /if \(!mission\)/);
});

test("credit is read from ledger rather than accepted from client input", () => {
  const route = source("src/app/api/journeys/[journeyId]/missions/[missionId]/route.ts");
  assert.match(route, /from\("myryra_journey_myra_ledger"\)/);
  assert.match(route, /myraAwarded: !rewardError && !!confirmedCredit && !existingCredit/);
  assert.doesNotMatch(route, /body\.(?:myraAwarded|score|passed)/);
});
