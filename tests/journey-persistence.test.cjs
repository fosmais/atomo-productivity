const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");
const filename = path.join(__dirname, "../src/lib/journey/save-confirmed-journey.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = module.paths;
mod._compile(compiled, filename);
const { saveConfirmedJourney } = mod.exports;
const key = "b00d7a13-4d5a-4d12-9b21-5b4f91234567";
const draft = {
  title: "Aprender italiano",
  requiresUserConfirmation: true,
  missions: [{ id: "week-1-plan", title: "Praticar italiano", week: 1, status: "pending" }],
};
function fakeClient({ authenticated = true, error = null, data = [{ journey_id: "journey-1", mission_count: 1 }] } = {}) {
  const calls = [];
  return {
    calls,
    client: {
      auth: { getUser: async () => ({ data: { user: authenticated ? { id: "user-1" } : null }, error: null }) },
      rpc: async (name, params) => { calls.push({ name, params }); return { data, error }; },
    },
  };
}
test("requires explicit confirmation without a database write", async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(saveConfirmedJourney(client, draft, false, key), /Confirme/);
  assert.equal(calls.length, 0);
});
test("requires authentication without a database write", async () => {
  const { client, calls } = fakeClient({ authenticated: false });
  await assert.rejects(saveConfirmedJourney(client, draft, true, key), /Autenticação/);
  assert.equal(calls.length, 0);
});
test("requires a valid confirmation key", async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(saveConfirmedJourney(client, draft, true), /Chave de confirmação necessária/);
  await assert.rejects(saveConfirmedJourney(client, draft, true, "invalid"), /Chave de confirmação inválida/);
  assert.equal(calls.length, 0);
});
test("persists the journey and missions through a single atomic RPC", async () => {
  const { client, calls } = fakeClient();
  const saved = await saveConfirmedJourney(client, draft, true, key);
  assert.deepEqual(saved, { id: "journey-1", missionCount: 1 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "myryra_confirm_journey_atomic");
  assert.deepEqual(calls[0].params, {
    p_title: draft.title, p_target_date: null, p_confirmation_key: key,
    p_mission_titles: ["Praticar italiano"],
  });
});
test("passes the target date to the atomic RPC", async () => {
  const { client, calls } = fakeClient();
  await saveConfirmedJourney(client, { ...draft, targetDate: "2027-06-01" }, true, key);
  assert.equal(calls[0].params.p_target_date, "2027-06-01");
});
test("rejects malformed dates before any database write", async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(saveConfirmedJourney(client, { ...draft, targetDate: "2027-02-30" }, true, key), /inválido/);
  assert.equal(calls.length, 0);
});
test("propagates RPC failure without claiming success", async () => {
  const { client } = fakeClient({ error: { code: "22023", message: "different missions" }, data: null });
  await assert.rejects(saveConfirmedJourney(client, draft, true, key), /Não foi possível salvar/);
});
test("rejects malformed RPC response", async () => {
  const { client } = fakeClient({ data: [{ journey_id: "journey-1", mission_count: 0 }] });
  await assert.rejects(saveConfirmedJourney(client, draft, true, key), /Não foi possível salvar/);
});
test("rejects invalid mission payload before RPC", async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(saveConfirmedJourney(client, { ...draft, missions: [{ title: "", status: "pending" }] }, true, key), /inválido/);
  assert.equal(calls.length, 0);
});

test("two simultaneous confirmations forward the same idempotency key", async () => {
  const calls = [];
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    rpc: async (name, params) => {
      calls.push({ name, params });
      await barrier;
      return { data: [{ journey_id: "journey-1", mission_count: 1 }], error: null };
    },
  };
  const first = saveConfirmedJourney(client, draft, true, key);
  const second = saveConfirmedJourney(client, draft, true, key);
  await new Promise((resolve) => setImmediate(resolve));
  release();
  const results = await Promise.all([first, second]);
  assert.deepEqual(results, [
    { id: "journey-1", missionCount: 1 },
    { id: "journey-1", missionCount: 1 },
  ]);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.name === "myryra_confirm_journey_atomic"));
  assert.ok(calls.every((call) => call.params.p_confirmation_key === key));
});

const draftFilename = path.join(__dirname, "../src/lib/journey/create-journey-draft.ts");
const draftCompiled = ts.transpileModule(fs.readFileSync(draftFilename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const draftModule = new Module(draftFilename, module);
draftModule.filename = draftFilename;
draftModule.paths = module.paths;
draftModule._compile(draftCompiled, draftFilename);
const { createJourneyDraft } = draftModule.exports;

test("journey preview records the original planning day", () => {
  const planned = createJourneyDraft(
    { title: "Aprender italiano", targetDate: "2027-01-31" },
    new Date("2026-11-09T12:00:00Z"),
  );
  assert.equal(planned.plannedOn, "2026-11-09");
  assert.equal(planned.weeks, 12);
});

test("rebuilding the confirmed journey on its original day preserves missions", () => {
  const goal = { title: "Aprender italiano", targetDate: "2027-01-31", weeklyAvailabilityDays: 3 };
  const reviewed = createJourneyDraft(goal, new Date("2026-11-09T12:00:00Z"));
  const confirmedNextDay = createJourneyDraft(goal, new Date(reviewed.plannedOn + "T12:00:00Z"));
  const recomputedNextDay = createJourneyDraft(goal, new Date("2026-11-10T12:00:00Z"));
  assert.deepEqual(confirmedNextDay.missions, reviewed.missions);
  assert.equal(confirmedNextDay.weeks, reviewed.weeks);
  assert.equal(recomputedNextDay.plannedOn, "2026-11-10");
});
