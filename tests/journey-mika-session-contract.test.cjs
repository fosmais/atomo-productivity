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
  assert.match(api, /mission\.status !== "pending"/);
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
  assert.match(migration, /e.notes like \(\x27Jornada \x27 \|\| p_journey_id::text/);
  assert.match(migration, /grant execute .* to authenticated/i);
});

test("Journey booking bounds database lock waits and explains retries", () => {
  const migration = read("supabase/migrations/20261112000100_myryra_journey_lesson_atomic.sql");
  const ui = read("src/app/dashboard/mika-journey-planner.tsx");
  assert.match(migration, /set_config\('lock_timeout', '5s', true\)/);
  assert.match(ui, /bookingError\.code === "55P03"/);
  assert.match(ui, /bookingError\.code === "40P01"/);
  assert.match(ui, /bookingError\.code === "PGRST202"/);
});

test("Journey booking UI checks only blocking events and scopes duplicates to the journey", () => {
  const ui = read("src/app/dashboard/mika-journey-planner.tsx");
  assert.match(ui, /event\.blocksTime && new Date\(event\.startsAt\)/);
  assert.match(ui, /event\.notes\?\.startsWith\(missionMarker\)/);
  assert.match(ui, /"Jornada " \+ journeyId \+ " · missão " \+ missionId/);
  assert.doesNotMatch(ui, /saveCloudEvent\(/);
});

test("Completed missions hide lesson and booking actions and close stale lesson panels", () => {
  const ui = read("src/app/dashboard/mika-journey-planner.tsx");
  assert.match(ui, /journey\.status === "active" && mission\.status === "pending" && <button type="button" disabled=\{lessonBusy\}/);
  assert.match(ui, /journey\.status === "active" && mission\.status === "pending" && <button type="button" disabled=\{scheduleBusy\}/);
  assert.match(ui, /if \(payload\.mission\.status === "completed"\)/);
});

test("Rapid journey switching ignores stale mission responses and resets lesson state", () => {
  const ui = read("src/app/dashboard/mika-journey-planner.tsx");
  assert.match(ui, /const journeyOpenRequestRef = useRef\(0\)/);
  assert.match(ui, /const requestId = \+\+journeyOpenRequestRef\.current/);
  assert.match(ui, /if \(requestId !== journeyOpenRequestRef\.current\) return/);
  assert.match(ui, /setScheduleMissionId\(null\)/);
  assert.ok(ui.includes('setLessonInput("");'));
});

test("MIKA ignores replies from a journey that was closed or switched", () => {
  const ui = read("src/app/dashboard/mika-journey-planner.tsx");
  assert.match(ui, /const lessonRequestRef = useRef\(0\)/);
  assert.match(ui, /\+\+lessonRequestRef\.current/);
  assert.match(ui, /if \(requestId !== lessonRequestRef\.current\) return/);
  assert.match(ui, /if \(requestId === lessonRequestRef\.current\) setLessonBusy\(false\)/);
  assert.match(ui, /catch \(error\) \{\s*if \(requestId !== lessonRequestRef\.current\) return;\s*\/\/ Preserve the student/);
});

test("Confirmed Journey booking offers a real link to the Agenda section", () => {
  const ui = read("src/app/dashboard/mika-journey-planner.tsx");
  const dashboard = read("src/app/dashboard/page.tsx");
  assert.match(ui, /message\.startsWith\("Aula criada na Agenda MYRYRA\."\)/);
  assert.match(ui, /href="\/dashboard#vyra-calendar"/);
  assert.match(ui, /Abrir minha Agenda/);
  assert.match(dashboard, /<VyraModule id="vyra-calendar">/);
});

test("Journey booking never claims success without a confirmed event identifier", () => {
  const ui = read("src/app/dashboard/mika-journey-planner.tsx");
  assert.match(ui, /data: bookedEventId, error: bookingError/);
  assert.match(ui, /typeof bookedEventId !== "string"/);
  assert.match(ui, /Consulte a Agenda antes de tentar novamente para evitar duplicidade/);
  assert.ok(ui.indexOf('typeof bookedEventId !== "string"') < ui.indexOf('setMessage("Aula criada na Agenda MYRYRA.'));
});
