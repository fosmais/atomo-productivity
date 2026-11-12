const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "../src/lib/journey/mika-session-context.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const promptExports = {};
vm.runInNewContext(compiled, { exports: promptExports, Number, JSON, Error }, { timeout: 1000 });
const { buildMikaJourneySessionPrompt } = promptExports;

test("Italian mission generates contextual teaching and correction instructions", () => {
  const prompt = buildMikaJourneySessionPrompt({
    journeyTitle: "Aprender italiano", missionTitle: "Apresentar-se e dizer de onde vem",
    learnerLevel: "iniciante", language: "português brasileiro", durationMinutes: 20,
  });
  for (const expected of ["Aprender italiano", "Apresentar-se e dizer de onde vem", "iniciante",
    "aponte no máximo dois erros concretos", "Não reinicie a aula",
    "só avalie pronúncia quando houver áudio", "Não alegue ter criado eventos"]) {
    assert.ok(prompt.includes(expected), expected);
  }
});

test("Other journeys get their own topic instead of an Italian-only script", () => {
  const prompt = buildMikaJourneySessionPrompt({ journeyTitle: "Correr 10 km", missionTitle: "Planejar uma semana de treinos" });
  assert.match(prompt, /Correr 10 km/);
  assert.match(prompt, /Planejar uma semana de treinos/);
  assert.match(prompt, /qualquer tema apropriado/);
});

test("Empty goals are rejected and prompt inputs are bounded", () => {
  assert.throws(() => buildMikaJourneySessionPrompt({ journeyTitle: " ", missionTitle: "Aula" }));
  const prompt = buildMikaJourneySessionPrompt({
    journeyTitle: "A".repeat(500), missionTitle: "B".repeat(500), durationMinutes: 100000,
  });
  const match = prompt.match(/<dados_da_jornada>\n([^\n]+)\n<\/dados_da_jornada>/);
  assert.ok(match);
  const data = JSON.parse(match[1]);
  assert.equal(data.objetivo.length, 120);
  assert.equal(data.missao.length, 160);
  assert.equal(data.duracao_minutos, 20);
});
