const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

test("reconciled feedback binds optional exerciseId to latest owner-scoped assignment", () => {
  const route = source("src/app/api/journeys/feedback/route.ts");
  assert.match(route, /answer, exercise, exerciseId/);
  assert.match(route, /exerciseId !== undefined && \(typeof exerciseId !== "string" \|\| !uuid\.test\(exerciseId\)\)/);
  assert.match(route, /\.eq\("mission_id", missionId\)\.eq\("owner_id", user\.id\)/);
  assert.match(route, /\.order\("version", \{ ascending: false \}\)/);
  assert.match(route, /typeof exerciseId === "string" && assigned\.id !== exerciseId/);
});

test("reconciled feedback requires matching session and canonical server exercise", () => {
  const route = source("src/app/api/journeys/feedback/route.ts");
  assert.match(route, /assigned\.session_id && assigned\.session_id !== \(sessionId \?\? null\)/);
  assert.match(route, /\.eq\("journey_id", journeyId\)\.eq\("mission_id", missionId\)/);
  assert.match(route, /exercise: assigned\.exercise/);
  assert.match(route, /assessed_exercise_id: assessedExerciseId/);
});

test("reconciled feedback preserves first template issuance and stale grade guard", () => {
  const route = source("src/app/api/journeys/feedback/route.ts");
  assert.match(route, /educationalLessonFor\(mission\.title\)/);
  assert.match(route, /exercise: canonicalLesson\.exercise/);
  assert.match(route, /issueError\.code !== "23505"/);
  assert.match(route, /latestAssignment\?\.id \?\? null\) !== assessedExerciseId/);
  assert.match(route, /\.eq\("updated_at", priorProgress!\.updated_at\)/);
});

test("reconciled official exercise read remains owner-scoped and read-only", () => {
  const route = source("src/app/api/journeys/exercises/route.ts");
  assert.match(route, /hasCurrentLegalAcceptance\(user\.id\)/);
  assert.match(route, /\.eq\("id", journeyId\)\.eq\("owner_id", user\.id\)/);
  assert.match(route, /\.eq\("mission_id", missionId\)\.eq\("owner_id", user\.id\)/);
  assert.doesNotMatch(route, /export async function POST/);
});
