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
  assert.match(ui, /saveCloudEvent\(/);
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
