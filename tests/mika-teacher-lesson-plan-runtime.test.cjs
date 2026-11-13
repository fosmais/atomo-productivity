const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const filename = "src/lib/journey/lesson-plan.ts";
const transpiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: filename,
});
const exports = {};
vm.runInNewContext(transpiled.outputText, { exports }, { filename, timeout: 1000 });
const { proposeMikaLesson } = exports;

test("free lesson proposal produces a useful lesson plan without a journey", () => {
  const lesson = proposeMikaLesson({
    journeyId: "free", goal: "Conversação em italiano", topic: "Cumprimentos",
    level: "iniciante", durationMinutes: 20,
  });
  assert.equal(lesson.title, "Aula: Cumprimentos");
  assert.equal(lesson.durationMinutes, 20);
  assert.equal(lesson.requiresConfirmation, true);
  assert.equal(lesson.activities.length, 4);
  assert.match(lesson.assessment, /aplique Cumprimentos/);
});

test("lesson proposal adapts to prior completed topics and selected level", () => {
  const lesson = proposeMikaLesson({
    journeyId: "journey-1", goal: "Aprender italiano", topic: "Verbos no presente",
    level: "intermediário", completedTopics: ["Saudações", "Artigos"],
    durationMinutes: 45,
  });
  assert.match(lesson.activities[0], /Artigos/);
  assert.match(lesson.activities[1], /intermediário/);
  assert.equal(lesson.durationMinutes, 45);
});

test("lesson proposal rejects invalid duration and missing goal", () => {
  assert.throws(() => proposeMikaLesson({ journeyId: "free", goal: "Italiano", durationMinutes: 0 }), /Duração/);
  assert.throws(() => proposeMikaLesson({ journeyId: "free", goal: "Italiano", durationMinutes: 121 }), /Duração/);
  assert.throws(() => proposeMikaLesson({ journeyId: "free", goal: "   " }), /obrigatórios/);
});

test("lesson proposal trims oversized user input and normalizes whitespace", () => {
  const lesson = proposeMikaLesson({ journeyId: "free", goal: "Italiano", topic: "  Conversação    básica  " });
  assert.equal(lesson.title, "Aula: Conversação básica");
  const long = proposeMikaLesson({ journeyId: "free", goal: "Italiano", topic: "x".repeat(200) });
  assert.equal(long.title.length, "Aula: ".length + 120);
});
