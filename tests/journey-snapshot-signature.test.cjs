const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/journey/journey-snapshot-store.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleObj = { exports: {} };
vm.runInNewContext(compiled, { module: moduleObj, exports: moduleObj.exports, require, process, Buffer, Date, Set });
const { storeJourneySnapshot, loadJourneySnapshot } = moduleObj.exports;

test("signed snapshot survives reordered JSONB keys and rejects tampering", async () => {
  const previous = process.env.JOURNEY_SNAPSHOT_SIGNING_KEY;
  process.env.JOURNEY_SNAPSHOT_SIGNING_KEY = "test-key-not-for-production-0123456789abcdef";
  try {
    const user = { id: "123e4567-e89b-42d3-a456-426614174000" };
    const draft = {
      title: "Aprender italiano", weeks: 1, plannedOn: "2026-11-10",
      missions: [
        { id: "w1a", title: "Praticar vocabulário", week: 1, status: "pending" },
        { id: "w1b", title: "Praticar conversação", week: 1, status: "pending" },
      ], requiresUserConfirmation: true,
    };
    let row;
    const supabase = {
      auth: { getUser: async () => ({ data: { user }, error: null }) },
      from: () => ({
        insert: (record) => ({
          select: () => ({ single: async () => {
            row = record;
            return { data: { id: "123e4567-e89b-42d3-a456-426614174001" }, error: null };
          } }),
        }),
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: {
                draft: {
                  requiresUserConfirmation: row.draft.requiresUserConfirmation,
                  missions: row.draft.missions.map((m) => ({
                    status: m.status, week: m.week, title: m.title, id: m.id,
                  })),
                  plannedOn: row.draft.plannedOn, weeks: row.draft.weeks, title: row.draft.title,
                },
                // Simulate PostgREST serializing PostgreSQL timestamptz as an offset.
                expires_at: row.expires_at.replace("Z", "+00:00"), signature: row.signature,
              }, error: null }),
            }),
          }),
        }),
      }),
    };
    const id = await storeJourneySnapshot(supabase, draft);
    const loaded = await loadJourneySnapshot(supabase, id);
    assert.equal(loaded.title, draft.title);
    row.draft.missions[0].title = "Alteração não autorizada";
    await assert.rejects(loadJourneySnapshot(supabase, id), /Origem da prévia não verificada/);
  } finally {
    if (previous === undefined) delete process.env.JOURNEY_SNAPSHOT_SIGNING_KEY;
    else process.env.JOURNEY_SNAPSHOT_SIGNING_KEY = previous;
  }
});
