const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/mika/daily-briefing.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = new Module("mika-daily-briefing", module);
mod.filename = "mika-daily-briefing.js";
mod.paths = module.paths;
mod._compile(js, mod.filename);
const { buildMikaDailyBriefing } = mod.exports;

const base = { dayStart: "2026-11-08T00:00:00-03:00", dayEnd: "2026-11-09T00:00:00-03:00", now: "2026-11-08T09:00:00-03:00" };

test("returns priorities and available slots without changing input", () => {
  const tasks = [{ title: "Baixa", priority: "Baixa", completed: false }, { title: "Urgente", priority: "Alta", completed: false }];
  const events = [{ title: "Reunião", starts_at: "2026-11-08T10:00:00-03:00", ends_at: "2026-11-08T11:00:00-03:00", blocks_time: true }];
  const plan = buildMikaDailyBriefing({ ...base, tasks, events });
  assert.equal(plan.pendingTasks, 2);
  assert.equal(plan.priorities[0].title, "Urgente");
  assert.equal(plan.freeSlots[0].minutes, 60);
  assert.equal(plan.requiresApproval, true);
  assert.equal(tasks[0].title, "Baixa");
});

test("detects overlaps but not adjacent events", () => {
  const events = [
    { title: "A", starts_at: "2026-11-08T10:00:00-03:00", ends_at: "2026-11-08T11:00:00-03:00" },
    { title: "B", starts_at: "2026-11-08T10:30:00-03:00", ends_at: "2026-11-08T11:30:00-03:00" },
    { title: "C", starts_at: "2026-11-08T11:30:00-03:00", ends_at: "2026-11-08T12:00:00-03:00" }
  ];
  const plan = buildMikaDailyBriefing({ ...base, tasks: [], events });
  assert.deepEqual(plan.conflicts, [{ first: "A", second: "B" }]);
});

test("does not count completed tasks and handles overdue due dates", () => {
  const tasks = [
    { title: "Concluída", completed: true, due_date: "2026-11-01" },
    { title: "Atrasada", completed: false, due_date: "2026-11-07" },
    { title: "Hoje", completed: false, due_date: "2026-11-08" }
  ];
  const plan = buildMikaDailyBriefing({ ...base, tasks, events: [] });
  assert.equal(plan.pendingTasks, 2);
  assert.equal(plan.overdueTasks, 1);
});

test("rejects invalid day ranges", () => {
  assert.throws(() => buildMikaDailyBriefing({ ...base, tasks: [], events: [], dayEnd: base.dayStart }));
});
