const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const route = fs.readFileSync(path.join(__dirname, "../src/app/api/concierge/route.ts"), "utf8");
const start = route.indexOf("function isRecord(");
const end = route.indexOf("export async function POST(", start);
assert.ok(start >= 0 && end > start, "Concierge validators must exist");

const normalizeStart = route.indexOf("    // The legacy single-task field", end);
const normalizeEnd = route.indexOf("    if (!isConciergeResponse(parsed)) {", normalizeStart);
assert.ok(normalizeStart >= 0 && normalizeEnd > normalizeStart, "Legacy task normalization must exist");

const validators = ts.transpileModule(route.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const context = vm.createContext({ Date });
vm.runInContext(validators, context);

function evaluate(response) {
  context.parsed = structuredClone(response);
  vm.runInContext(route.slice(normalizeStart, normalizeEnd), context);
  return {
    valid: vm.runInContext("isConciergeResponse(parsed)", context),
    result: structuredClone(context.parsed),
  };
}

const task = { title: "Estudar", priority: "Normal", dueDate: "2026-11-04" };
const base = { reply: "Vou preparar a tarefa.", proposedTasks: [task], proposedTask: null, proposedEvent: null };

test("accepts a valid single task", () => {
  const result = evaluate({ ...base, proposedTask: task });
  assert.equal(result.valid, true);
});

test("recovers a malformed legacy task from a validated task list", () => {
  const result = evaluate({ ...base, proposedTask: { ...task, dueDate: "amanhã" } });
  assert.equal(result.valid, true);
  assert.deepEqual(result.result.proposedTask, task);
});

test("recovers malformed legacy task to null when the validated list is empty", () => {
  const result = evaluate({ ...base, proposedTasks: [], proposedTask: { ...task, dueDate: "amanhã" } });
  assert.equal(result.valid, true);
  assert.equal(result.result.proposedTask, null);
});

test("rejects malformed tasks in the proposedTasks list", () => {
  const result = evaluate({ ...base, proposedTasks: [{ ...task, dueDate: "amanhã" }] });
  assert.equal(result.valid, false);
});

test("rejects invalid event timing", () => {
  const result = evaluate({ ...base, proposedEvent: {
    title: "Reunião", startsAt: "2026-11-04T13:00:00Z",
    endsAt: "2026-11-04T12:00:00Z", location: null,
    eventType: "appointment", blocksTime: true,
  } });
  assert.equal(result.valid, false);
});

test("rejects an empty reply", () => {
  assert.equal(evaluate({ ...base, reply: "" }).valid, false);
});
