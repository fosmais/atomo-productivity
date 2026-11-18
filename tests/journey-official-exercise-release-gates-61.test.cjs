const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

test("feedback requires authenticated owner, saved answer and linked teacher session", () => {
  const route = source("src/app/api/journeys/feedback/route.ts");
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /\.eq\("id", journeyId\)\.eq\("owner_id", user\.id\)/);
  assert.match(route, /\.eq\("journey_id", journeyId\)\.eq\("mission_id", missionId\)/);
  assert.match(route, /priorProgress\?\.answer\?\.trim\(\) !== answer\.trim\(\)/);
  assert.match(route, /\.eq\("updated_at", priorProgress!\.updated_at\)/);
});

test("completion fails closed when assessment policy is unavailable", () => {
  const route = source("src/app/api/journeys/[journeyId]/missions/[missionId]/route.ts");
  assert.match(route, /\.from\("myryra_journey_mission_assessment_policy"\)/);
  assert.match(route, /if \(policyError\) return NextResponse\.json\(\{ error: "Política de avaliação indisponível\." \}, \{ status: 503 \}\)/);
  assert.match(route, /learning\.assessment_passed !== true/);
  assert.match(route, /learning\.assessment_score < minimumScore/);
});

test("official exercise schema candidate is gated outside automatic migrations", () => {
  const candidate = source("docs/mvp2/sql/journey-assigned-exercises-61-CANDIDATE-DO-NOT-APPLY.sql");
  assert.match(candidate, /Existing assigned exercises table: reconcile drift manually/);
  assert.match(candidate, /create trigger myryra_validate_assigned_exercise/);
  assert.match(candidate, /alter table public\.myryra_journey_assigned_exercises enable row level security/);
  assert.match(candidate, /grant select on public\.myryra_journey_assigned_exercises to authenticated/);
  assert.doesNotMatch(candidate, /grant (?:insert|update|delete|all) on public\.myryra_journey_assigned_exercises to (?:anon|authenticated)/i);
});

test("official exercise issuance remains a release gate, not an implemented feature", () => {
  const contract = source("docs/security/journey-official-exercise-api-contract-61.md");
  assert.match(contract, /Status:\*\* especificação para revisão, não implementada/);
  assert.match(contract, /versão mais recente/);
  assert.match(contract, /duas contas autenticadas/);
});

test("official exercise read is scoped to authenticated owner, mission and legal acceptance", () => {
  const route = source("src/app/api/journeys/exercises/route.ts");
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /hasCurrentLegalAcceptance\(user\.id\)/);
  assert.match(route, /\.eq\("id", journeyId\)\.eq\("owner_id", user\.id\)/);
  assert.match(route, /\.eq\("id", missionId\)\.eq\("journey_id", journeyId\)/);
  assert.match(route, /\.eq\("mission_id", missionId\)\.eq\("owner_id", user\.id\)/);
  assert.match(route, /\.order\("version", \{ ascending: false \}\)/);
  assert.doesNotMatch(route, /export async function POST/);
});

test("official feedback uses server exercise text and blocks legacy bypass", () => {
  const route = source("src/app/api/journeys/feedback/route.ts");
  assert.match(route, /canonicalExercise = assigned\.exercise/);
  assert.match(route, /if \(!officialExerciseId\)/);
  assert.match(route, /if \(issued\) return NextResponse\.json/);
  assert.match(route, /latest\.id !== assigned\.id/);
  assert.match(route, /assessed_exercise_id: officialExerciseId/);
  assert.match(route, /typeof exerciseId !== "string" && \(typeof exercise !== "string"/);
});

test("PR60 preview admin connection is restricted to staging", () => {
  const admin = source("src/lib/supabase/admin.ts");
  assert.match(admin, /test\/mvp2-journey-security-integration-57-59/);
  assert.match(admin, /stagingUrl\.hostname !== "xanavauqzsrgvdfhcrsm\.supabase\.co"/);
});
