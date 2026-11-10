const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/journey/replan-safety.ts"), "utf8");
const compiled = ts.transpileModule(source.replace("export function validateReplan", "function validateReplan") + "\nmodule.exports = { validateReplan };", {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleShim = { exports: {} };
new Function("module", compiled)(moduleShim);
const { validateReplan } = moduleShim.exports;

test("preserves completed missions and replaces pending missions only", () => {
  const result = validateReplan(
    [{ id: "done", title: "Estudar italiano", status: "completed" }, { id: "todo", title: "Praticar conversação", status: "pending" }],
    [{ title: "Conversar por 10 minutos", week: 1 }],
  );
  assert.deepEqual(result.completedIds, ["done"]);
  assert.deepEqual(result.pendingIds, ["todo"]);
  assert.deepEqual(result.replacementTitles, ["Conversar por 10 minutos"]);
});

test("rejects repeated completed missions even with accents and case changes", () => {
  assert.throws(() => validateReplan(
    [{ id: "done", title: "Revisão diária", status: "completed" }],
    [{ title: "  REVISAO   DIARIA  ", week: 1 }],
  ), /repete/);
});

test("rejects duplicate proposals and invalid mission states", () => {
  assert.throws(() => validateReplan([], [
    { title: "Primeira missão", week: 1 }, { title: "primeira missão", week: 2 },
  ]), /repete/);
  assert.throws(() => validateReplan([{ id: "x", title: "X", status: "archived" }], [
    { title: "Nova missão", week: 1 },
  ]), /não suportado/);
});

test("rejects empty proposals, invalid weeks and oversized titles", () => {
  assert.throws(() => validateReplan([], []), /entre 1 e 104/);
  assert.throws(() => validateReplan([], [{ title: "Nova missão", week: 0 }]), /inválida/);
  assert.throws(() => validateReplan([], [{ title: "x".repeat(161), week: 1 }]), /inválida/);
});
