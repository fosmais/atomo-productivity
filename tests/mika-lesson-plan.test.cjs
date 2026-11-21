const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const file = path.join(__dirname, "../src/lib/journey/lesson-plan.ts");
const source = fs.readFileSync(file, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, { exports: exportsObject }, { filename: file });
const { proposeMikaLesson } = exportsObject;

test("creates a personalized proposal without scheduling", () => {
  const lesson = proposeMikaLesson({
    journeyId: "journey-1", goal: "Aprender italiano", topic: "Cumprimentos",
    level: "iniciante", durationMinutes: 20, language: "pt-BR",
  });
  assert.equal(lesson.title, "Aula: Cumprimentos");
  assert.equal(lesson.durationMinutes, 20);
  assert.equal(lesson.requiresConfirmation, true);
  assert.match(lesson.assessment, /resposta efetiva/);
});

test("works for other topics and revisits previous work", () => {
  const lesson = proposeMikaLesson({
    journeyId: "journey-2", goal: "Aprender Python", topic: "Funções",
    completedTopics: ["Variáveis"],
  });
  assert.match(lesson.activities[0], /Variáveis/);
  assert.match(lesson.objective, /Python/);
});

test("rejects missing goals and invalid durations", () => {
  assert.throws(() => proposeMikaLesson({ journeyId: "x", goal: "  " }), /obrigatórios/);
  assert.throws(() => proposeMikaLesson({ journeyId: "x", goal: "Estudar", durationMinutes: 5 }), /Duração/);
  assert.throws(() => proposeMikaLesson({ journeyId: "x", goal: "Estudar", durationMinutes: 121 }), /Duração/);
  assert.throws(() => proposeMikaLesson({ journeyId: "x", goal: "Estudar", durationMinutes: 20.5 }), /Duração/);
});

test("does not mutate the input", () => {
  const input = Object.freeze({ journeyId: "journey-3", goal: "Fotografia" });
  const lesson = proposeMikaLesson(input);
  assert.equal(input.goal, "Fotografia");
  assert.equal(lesson.requiresConfirmation, true);
});
