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

test("MIKA uses consolidated monthly goal contribution", () => {
  assert.ok(source.includes("const monthlyNeeded = Math.ceil(totalRemaining / goalHorizonMonths);"));
  assert.ok(source.includes("Math.ceil(goals.reduce((sum, goal) => sum + Math.max(0, goal.target_cents - goal.saved_cents), 0) / goalHorizonMonths)"));
});

test("fully funded goals show a clear no-contribution status", () => {
  assert.ok(source.includes('needed === 0 ? "Nenhum aporte adicional é necessário para as metas atuais."'));
});

test("completed goals hide the irrelevant monthly difference", () => {
  assert.ok(source.includes('needed > 0 && <>'));
  assert.ok(source.includes('Diferença mensal:'));
});

test("currency parser enforces zero capacity and positive goals", () => {
  const vm = require("node:vm");
  const start = source.indexOf("function parseCents(");
  const end = source.indexOf("\nexport default function", start);
  assert.ok(start >= 0 && end > start);
  const parserSource = source.slice(start, end)
    .replace("input: string, allowZero = false", "input, allowZero = false")
    .replace("let normalized: string;", "let normalized;");
  const parse = vm.runInNewContext(parserSource + "\nparseCents");
  assert.equal(parse("0"), null);
  assert.equal(parse("0", true), 0);
  assert.equal(parse("1.000,50"), 100050);
  assert.equal(parse("R$ 1.000,50"), 100050);
  assert.equal(parse("-1", true), null);
  assert.equal(parse("abc", true), null);
});

test("priority allocation explains independent contribution rounding", () => {
  assert.ok(source.includes("Os aportes são arredondados para cima por meta"));
  assert.ok(source.includes("const totalNeeded = allocations.reduce"));
});

test("MIKA does not recommend additional contributions for completed individual goals", () => {
  assert.ok(source.includes('remaining === 0 ? "Esta meta já está coberta'));
  assert.ok(source.includes("Não recomende novos aportes para ela"));
});
