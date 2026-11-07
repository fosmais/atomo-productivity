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

test("timeline shows today's events with accessible agenda navigation", () => {
  const day = section('aria-label="Seu dia interativo"', 'aria-label="Resumo rápido"');
  assert.ok(day.includes('aria-label="Linha do tempo de hoje"'));
  assert.ok(day.includes('dayEvents.map('));
  assert.ok(day.includes('dateTime={event.start}'));
  assert.ok(day.includes('navigateTo("vyra-calendar")'));
});

test("timeline limits results and handles unavailable agenda", () => {
  assert.ok(source.includes('.slice(0, 5)'));
  assert.ok(source.includes('setDayEvents([])'));
  assert.ok(source.includes('Agenda indisponível. Tente novamente na Agenda.'));
});

test("timeline compares dates in local timezone without locale-format assumptions", () => {
  assert.ok(source.includes("function localDayKey(date: Date)"));
  assert.ok(source.includes("localDayKey(new Date(event.start)) === todayKey"));
  assert.ok(!source.includes('toLocaleDateString("en-CA")'));
});

test("timeline refreshes on calendar update and cleans up listener", () => {
  assert.ok(source.includes('window.addEventListener("myryra:events-updated", loadAgenda)'));
  assert.ok(source.includes('window.removeEventListener("myryra:events-updated", loadAgenda)'));
});

test("home provides safe task completion entry without direct mutation", () => {
  const day = section('aria-label="Seu dia interativo"', 'aria-label="Resumo rápido"');
  assert.ok(day.includes("Concluir tarefas"));
  assert.ok(day.includes('onClick={() => navigateTo("vyra-tasks")}'));
});

test("each timeline event offers an accessible reschedule entry", () => {
  const day = section('aria-label="Seu dia interativo"', 'aria-label="Resumo rápido"');
  assert.ok(day.includes("Ver / reagendar"));
  assert.ok(day.includes('aria-label={\`Ver ou reagendar ${event.title} na Agenda\`}'));
  assert.ok(day.includes('onClick={() => navigateTo("vyra-calendar")}'));
});
