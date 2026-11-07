const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/vyra-home.tsx"), "utf8");
const section = (start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, "Missing Home section: " + start);
  return source.slice(from, to);
};

test("MVP2 home introduces approved heading and interactive day", () => {
  assert.ok(source.includes("Seu dia começa aqui"));
  assert.ok(source.includes('aria-label="Seu dia interativo"'));
});

test("interactive day reuses agenda, tasks, MIKA and capture navigation", () => {
  const day = section('aria-label="Seu dia interativo"', 'aria-label="Resumo rápido"');
  assert.ok(day.includes('navigateTo("vyra-calendar")'));
  assert.ok(day.includes('navigateTo("vyra-tasks")'));
  assert.ok(day.includes('navigateTo("vyra-ai")'));
  assert.ok(day.includes('navigateToQuickAction?.("capture")'));
});

test("interactive day handles missing agenda and metrics without fabricated data", () => {
  const day = section('aria-label="Seu dia interativo"', 'aria-label="Resumo rápido"');
  assert.ok(day.includes("agendaError"));
  assert.ok(day.includes("nextEvent ? nextEvent.title"));
  assert.ok(day.includes("metrics ? metrics.pending"));
});

test("interactive day does not create new financial or calendar mutations", () => {
  const day = section('aria-label="Seu dia interativo"', 'aria-label="Resumo rápido"');
  assert.ok(!day.includes(".insert("));
  assert.ok(!day.includes(".update("));
  assert.ok(!day.includes(".delete("));
});
