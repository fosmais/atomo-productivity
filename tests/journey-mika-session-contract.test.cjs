const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Journey exposes a contextual MIKA conversation entrypoint", () => {
  const ui = read("src/app/dashboard/mika-journey-planner.tsx");
  assert.match(ui, /Iniciar com a MIKA/);
  assert.match(ui, /\/mika-session/);
  assert.match(ui, /lessonTurns/);
});

test("MIKA lesson API checks ownership, active status, and does not award MYRAs", () => {
  const api = read("src/app/api/journeys/[journeyId]/mika-session/route.ts");
  assert.match(api, /\.eq\("owner_id", user\.id\)/);
  assert.match(api, /journey\.status !== "active"/);
  assert.match(api, /\.eq\("journey_id", journeyId\)/);
  assert.match(api, /myraAwarded: false/);
});

test("Journey calendar lessons require confirmation and check conflicts", () => {
  const ui = read("src/app/dashboard/mika-journey-planner.tsx");
  assert.match(ui, /window\.confirm\(/);
  assert.match(ui, /getCloudEvents\(\)/);
  assert.match(ui, /myryra_book_journey_lesson/);
  assert.match(ui, /Agendar aula na Agenda/);
});

test("MIKA session instructions support any topic and no false completion claims", () => {
  const prompt = read("src/lib/journey/mika-session-context.ts");
  assert.match(prompt, /qualquer tema/);
  assert.match(prompt, /não confiável/);
  assert.match(prompt, /Não alegue ter criado eventos/);
});

test("New journeys opt into contextual MIKA planning by default", () => {
  const ui = read("src/app/dashboard/mika-journey-planner.tsx");
  assert.match(ui, /\[useAI, setUseAI\] = useState\(true\)/);
  assert.match(ui, /Personalizar com a MIKA \(recomendado/);
});

test("MIKA lessons use the authenticated UUID for quota enforcement", () => {
  const api = read("src/app/api/journeys/[journeyId]/mika-session/route.ts");
  assert.match(api, /checkConciergeRateLimit\(user\.id\)/);
  assert.doesNotMatch(api, /checkConciergeRateLimit\(`journey-session:/);
  assert.match(api, /messages\.some\(\(turn, index\)/);
});

test("MIKA lesson retains learner input on request failure and resets between missions", () => {
  const ui = read("src/app/dashboard/mika-journey-planner.tsx");
  assert.match(ui, /if \(!answer\) \{\s*setLessonMissionId\(missionId\);\s*setLessonTurns\(\[\]\);/);
  assert.match(ui, /if \(answer\) setLessonInput\(answer\);/);
});

test("Long MIKA conversations retain an odd number of turns starting with the learner", () => {
  const ui = read("src/app/dashboard/mika-journey-planner.tsx");
  const api = read("src/app/api/journeys/[journeyId]/mika-session/route.ts");
  assert.match(ui, /messages: next\.slice\(-11\)/);
  assert.match(api, /messages\.some\(\(turn, index\)/);
});

test("Journey lesson booking uses an owner-scoped, serialized database transaction", () => {
  const migration = read("supabase/migrations/20261112000100_myryra_journey_lesson_atomic.sql");
  assert.match(migration, /security invoker/i);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /lock table public\.events in share row exclusive mode/i);
  assert.match(migration, /j.owner_id = v_user/);
  assert.match(migration, /e.deleted_at is null/);
  assert.match(migration, /grant execute .* to authenticated/i);
});
