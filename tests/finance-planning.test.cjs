const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/finance-planning.tsx"), "utf8");

test("financial goals allow zero savings capacity but not zero goal values", () => {
  assert.ok(source.includes("allowZero = false"));
  assert.ok(source.includes("parseCents(monthlyCapacityInput, true)"));
});

test("financial goals explain the zero-capacity scenario", () => {
  assert.ok(source.includes("capacity === 0 && needed > 0"));
  assert.ok(source.includes("Sem valor disponível para aportes"));
});

test("MIKA receives zero-capacity financial planning context", () => {
  assert.ok(source.includes("capacity === 0 && totalRemaining > 0"));
  assert.ok(source.includes("Priorize revisar despesas"));
});

test("fully funded goals do not trigger extra contribution advice", () => {
  assert.ok(source.includes("needed === 0"));
  assert.ok(source.includes("totalRemaining === 0"));
  assert.ok(source.includes("Não sugira aportes adicionais"));
});
