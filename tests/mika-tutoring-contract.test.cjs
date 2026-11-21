const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");

test("MIKA tutoring requires diagnosis, teaching, worked examples and checkable practice", () => {
  const route = read("src/app/api/journeys/feedback/route.ts");
  for (const term of ["diagnóstico específico", "microaula", "exemplo resolvido", "exercício novo", "habilidade a reforçar", "20 minutos"]) {
    assert.ok(route.includes(term), `Missing tutoring requirement: ${term}`);
  }
  assert.match(route, /store: false/);
  assert.match(route, /checkConciergeRateLimit\(user\.id\)/);
  assert.match(route, /\.eq\("owner_id", user\.id\)/);
  assert.match(route, /myryra_journey_learning_progress/);
});

test("Editing an answer invalidates old feedback before reevaluation", () => {
  const ui = read("src/app/journey/journey-trail.tsx");
  assert.match(ui, /setAiFeedback\(oldFeedback => \(\{ \.\.\.oldFeedback, \[m\.id\]: "" \}\)\)/);
  const route = read("src/app/api/journeys/learning/route.ts");
  assert.match(route, /previous\?\.answer === answer \? previous\.feedback : null/);
});

test("Adaptive MIKA feedback reads only the learner's own previous attempt", () => {
  const route = read("src/app/api/journeys/feedback/route.ts");
  assert.match(route, /\.select\("answer,feedback(?:,assessment_attempts)?"\)\.eq\("mission_id", missionId\)\.eq\("owner_id", user\.id\)/);
  assert.match(route, /previousAttempt: priorProgress\?\.feedback/);
  assert.match(route, /compare com a nova resposta/);
  assert.match(route, /não presuma melhora se não houver evidência/);
  assert.match(route, /checkConciergeRateLimit\(user\.id\)/);
});
