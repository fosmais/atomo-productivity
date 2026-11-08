const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = relative => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
const wallet = read("src/app/dashboard/myryra-finance-starter.tsx");
const subscriptions = read("src/app/dashboard/finance-subscriptions.tsx");
const migration = read("docs/sql/mvp2-finance-edit-trash-candidate.sql");

// These are source-level regression guards, not an authenticated integration test.
test("wallet edits only the current user's row and verifies the persisted values", () => {
  assert.match(wallet, /onSubmit=\{editingId \? saveEditing : addEntry\}/);
  const edit = wallet.split("const saveEditing = async")[1].split("const addEntry = async")[0];
  assert.match(edit, /\.eq\("id", editingId\)\.eq\("user_id", auth\.user\.id\)/);
  assert.match(edit, /\.select\("id,description,amount_cents,kind,created_at"\)\.single\(\)/);
  assert.match(edit, /data\.amount_cents !== cents/);
  assert.match(edit, /calculateBalanceCents\(openingBalanceCents/);
  assert.match(wallet, /onClick=\{\(\) => startEditing\(item\)\}/);
});

test("subscription edits are owner-scoped and confirm all returned fields", () => {
  assert.match(subscriptions, /onSubmit=\{editingId \? saveEditing : add\}/);
  const edit = subscriptions.split("async function saveEditing")[1].split("async function remove")[0];
  assert.match(edit, /\.eq\("id", editingId\)\.eq\("user_id", auth\.user\.id\)/);
  for (const field of ["title", "amount_cents", "billing_cycle", "next_due_date"]) {
    assert.ok(edit.includes("data." + field), "missing persisted verification: " + field);
  }
  assert.match(subscriptions, /onClick=\{\(\) => startEditing\(item\)\}/);
});

test("migration restricts both UPDATE policies to the owner and keeps trash gated", () => {
  for (const table of ["myryra_finance_entries", "myryra_finance_subscriptions"]) {
    const policy = migration.split("CREATE POLICY finance_" + (table.endsWith("entries") ? "entries" : "subscriptions") + "_update_own")[1];
    assert.ok(policy, "missing policy for " + table);
    const statement = policy.split(";")[0];
    assert.ok(statement.includes("FOR UPDATE TO authenticated"));
    assert.ok(statement.includes("USING ((SELECT auth.uid()) = user_id)"));
    assert.ok(statement.includes("WITH CHECK ((SELECT auth.uid()) = user_id)"));
  }
  assert.match(migration, /ADD COLUMN IF NOT EXISTS deleted_at timestamptz/);
  assert.match(wallet, /NEXT_PUBLIC_MYRYRA_FINANCE_TRASH_ENABLED === "true"/);
});


test("soft-delete flag consistently excludes trashed entries from summaries and forecasts", () => {
  const monthly = read("src/app/dashboard/finance-monthly-summary.tsx");
  const forecast = read("src/app/dashboard/finance-subscriptions.tsx");
  for (const [name, source] of [["monthly", monthly], ["forecast", forecast]]) {
    assert.ok(source.includes('NEXT_PUBLIC_MYRYRA_FINANCE_TRASH_ENABLED === "true"'), name + " must gate the trash filter");
    assert.ok(source.includes('.is("deleted_at", null)'), name + " must filter out deleted entries");
  }
  assert.ok(monthly.includes("entryQuery.order("), "monthly summary must execute the filtered query");
  assert.ok(forecast.includes("historyQuery.limit(1000)"), "forecast must execute the filtered query");
});
