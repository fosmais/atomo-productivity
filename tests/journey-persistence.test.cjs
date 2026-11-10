const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");

const filename = path.join(__dirname, "../src/lib/journey/save-confirmed-journey.ts");
const source = fs.readFileSync(filename, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = module.paths;
mod._compile(compiled, filename);
const { saveConfirmedJourney } = mod.exports;
const draft = {
  title: "Aprender italiano",
  requiresUserConfirmation: true,
  missions: [{ id: "week-1-plan", title: "Praticar italiano", week: 1, status: "pending" }],
};

function fakeClient({ authenticated = true, missionError = null, cleanupError = null } = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({
      data: { user: authenticated ? { id: "user-1" } : null },
      error: null,
    }) },
    from(table) {
      const query = {
        insert(rows) {
          calls.push({ table, operation: "insert", rows });
          if (table === "myryra_journey_missions") return Promise.resolve({ error: missionError });
          return query;
        },
        select() { return query; },
        single: async () => ({ data: { id: "journey-1" }, error: null }),
        delete() { calls.push({ table, operation: "delete" }); return query; },
        eq(column, value) {
          calls.push({ table, operation: "filter", column, value });
          if (column === "owner_id") return Promise.resolve({ error: cleanupError });
          return query;
        },
      };
      return query;
    },
  };
  return { client, calls };
}

test("does not write without explicit confirmation", async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(saveConfirmedJourney(client, draft, false), /Confirme/);
  assert.equal(calls.length, 0);
});

test("does not write for unauthenticated user", async () => {
  const { client, calls } = fakeClient({ authenticated: false });
  await assert.rejects(saveConfirmedJourney(client, draft, true), /Autenticação/);
  assert.equal(calls.length, 0);
});

test("persists journey and missions for authenticated user", async () => {
  const { client, calls } = fakeClient();
  const result = await saveConfirmedJourney(client, draft, true);
  assert.deepEqual(result, { id: "journey-1", missionCount: 1 });
  assert.equal(calls.filter((c) => c.operation === "insert").length, 2);
  assert.equal(calls[0].rows.owner_id, "user-1");
  assert.equal(calls[1].rows[0].journey_id, "journey-1");
});

test("cleans up journey if mission insert fails", async () => {
  const { client, calls } = fakeClient({ missionError: { message: "insert failed" } });
  await assert.rejects(saveConfirmedJourney(client, draft, true), /revertida/);
  assert.ok(calls.some((c) => c.operation === "delete"));
});

test("reports orphaned journey if cleanup fails", async () => {
  const { client } = fakeClient({
    missionError: { message: "insert failed" },
    cleanupError: { message: "cleanup failed" },
  });
  await assert.rejects(saveConfirmedJourney(client, draft, true), /journey-1/);
});

test("persists the confirmed target date", async () => {
  const { client, calls } = fakeClient();
  await saveConfirmedJourney(client, { ...draft, targetDate: "2027-06-01" }, true);
  assert.equal(calls[0].rows.target_date, "2027-06-01");
});

test("rejects malformed target dates before any database write", async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(saveConfirmedJourney(client, { ...draft, targetDate: "2027-02-30" }, true), /inválido/);
  assert.equal(calls.length, 0);
});
