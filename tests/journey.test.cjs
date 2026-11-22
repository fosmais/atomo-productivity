const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");

const filename = path.join(__dirname, "../src/lib/journey/create-journey-draft.ts");
const source = fs.readFileSync(filename, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = module.paths;
mod._compile(compiled, filename);
const { createJourneyDraft } = mod.exports;
const today = new Date("2026-11-09T00:00:00Z");

test("creates a four-week draft requiring confirmation", () => {
  const draft = createJourneyDraft({ title: "  Aprender   italiano  " }, today);
  assert.equal(draft.title, "Aprender italiano");
  assert.equal(draft.weeks, 4);
  assert.equal(draft.missions.length, 8);
  assert.equal(draft.requiresUserConfirmation, true);
  assert.ok(draft.missions.every((m) => m.status === "pending"));
});

test("rejects invalid goal and availability", () => {
  assert.throws(() => createJourneyDraft({ title: "   " }, today));
  assert.throws(() => createJourneyDraft({ title: "x".repeat(121) }, today));
  assert.throws(() => createJourneyDraft({ title: "Correr", weeklyAvailabilityDays: 0 }, today));
  assert.throws(() => createJourneyDraft({ title: "Correr", weeklyAvailabilityDays: 8 }, today));
});

test("rejects invalid or past dates", () => {
  for (const targetDate of ["2026-02-30", "2026-11-08", "bad"]) {
    assert.throws(() => createJourneyDraft({ title: "Correr", targetDate }, today));
  }
});

test("caps long journeys at 52 weeks", () => {
  const draft = createJourneyDraft({ title: "Aprender italiano", targetDate: "2030-01-01" }, today);
  assert.equal(draft.weeks, 52);
  assert.equal(draft.missions.length, 104);
});

test("generated mission titles respect database length limit", () => {
  const draft = createJourneyDraft({ title: "x".repeat(120) }, today);
  assert.ok(draft.missions.every((m) => m.title.length <= 160));
});

test("travel goals generate specific and progressive milestones", () => {
  const draft = createJourneyDraft({ title: "Viagem para Itália", targetDate: "2027-04-30", weeklyAvailabilityDays: 3 }, today);
  assert.equal(draft.weeks, 25);
  assert.equal(draft.missions.length, 50);
  assert.match(draft.missions[0].title, /Escolher as cidades/);
  assert.ok(draft.missions.some((m) => /passaporte|documentos/.test(m.title)));
  assert.ok(draft.missions.some((m) => /orçamento|passagens/.test(m.title)));
  assert.ok(draft.missions.every((m) => !/Definir e executar uma ação concreta|Registrar o resultado e escolher o próximo passo/.test(m.title)));
  assert.ok(draft.missions.every((m) => m.title.length <= 160));
});

test("study abroad goals avoid generic filler and include school and migration preparation", () => {
  const draft = createJourneyDraft({ title: "Intercâmbio Malta", targetDate: "2027-04-30", weeklyAvailabilityDays: 3 }, today);
  assert.equal(draft.missions.length, draft.weeks * 2);
  assert.match(draft.missions[0].title, /objetivo do intercâmbio/);
  assert.ok(draft.missions.some((m) => /escolas|matrícula/.test(m.title)));
  assert.ok(draft.missions.some((m) => /migratórios|passaporte/.test(m.title)));
  assert.ok(draft.missions.every((m) => !/Definir e executar uma ação concreta|Registrar o resultado e escolher o próximo passo/.test(m.title)));
  assert.ok(draft.missions.every((m) => m.title.length <= 160));
});
