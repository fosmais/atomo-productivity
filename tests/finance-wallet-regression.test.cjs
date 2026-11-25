const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/myryra-finance-starter.tsx"), "utf8");

test("wallet persists amounts as integer cents and validates BRL input", () => {
  assert.match(source, /const cents = Math\.round\(Number\(value\) \* 100\)/);
  assert.match(source, /Number\.isSafeInteger\(cents\)/);
  assert.match(source, /amount_cents: cents, kind/);
});

test("wallet reads paginated entries scoped to authenticated user", () => {
  assert.match(source, /client\.auth\.getUser\(\)/);
  assert.match(source, /from\("myryra_finance_entries"\)/);
  assert.match(source, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(source, /\.range\(offset, offset \+ pageSize - 1\)/);
});

test("wallet confirms saved opening balance before updating UI", () => {
  const start = source.indexOf("const saveOpeningBalance = async");
  const end = source.indexOf("const deleteEntry = async", start);
  const section = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(section, /onConflict: "user_id"/);
  assert.match(section, /savedBalance\.opening_balance_cents/);
  assert.ok(section.indexOf("if (!savedBalance") < section.indexOf("setOpeningBalanceCents(cents)"));
});

test("wallet confirms insert and delete responses before changing UI", () => {
  const insert = source.slice(source.indexOf("const addEntry = async"), source.indexOf("const saveOpeningBalance = async"));
  const deletion = source.slice(source.indexOf("const deleteEntry = async"), source.indexOf("  return (", source.indexOf("const deleteEntry = async")));
  assert.match(insert, /data\.amount_cents !== cents/);
  assert.ok(insert.indexOf("if (!data") < insert.indexOf("setEntries(previous =>"));
  assert.match(deletion, /\.eq\("id", id\)\.eq\("user_id", auth\.user\.id\)/);
  assert.ok(deletion.indexOf("deleted.length !== 1") < deletion.indexOf("setEntries(previous =>"));
});

test("wallet blocks writes while refresh is stale or pending", () => {
  assert.equal((source.match(/if \(saving \|\| balanceSaving \|\| loading \|\| error\) return;/g) || []).length, 3);
  assert.match(source, /requestId !== latestRequest/);
  assert.match(source, /setRefreshAttempt\(previous => previous \+ 1\)/);
});

test("trash stays disabled unless explicitly enabled and active ledger excludes deleted entries", () => {
  assert.match(source, /NEXT_PUBLIC_MYRYRA_FINANCE_TRASH_ENABLED === "true"/);
  const loadStart = source.indexOf("const load = async () => {");
  const loadEnd = source.indexOf("void load();", loadStart);
  const load = source.slice(loadStart, loadEnd);
  assert.match(load, /if \(trashEnabled\) query = query\.is\("deleted_at", null\)/);
  assert.match(load, /\.not\("deleted_at", "is", null\)/);
});

test("trash deletion and restoration are owner-scoped and require confirmed rows", () => {
  const deletionStart = source.indexOf("const deleteEntry = async");
  const deletionEnd = source.indexOf("const restoreEntry = async", deletionStart);
  const deletion = source.slice(deletionStart, deletionEnd);
  assert.match(deletion, /update\(\{ deleted_at: new Date\(\)\.toISOString\(\) \}\)/);
  assert.match(deletion, /\.eq\("user_id", auth\.user\.id\)/);
  const restoreStart = source.indexOf("const restoreEntry = async");
  const restoreEnd = source.indexOf("return (", restoreStart);
  const restore = source.slice(restoreStart, restoreEnd);
  assert.match(restore, /update\(\{ deleted_at: null \}\)/);
  assert.match(restore, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(restore, /data\.length !== 1/);
});

test("monthly finance summary excludes soft-deleted entries when trash is enabled", () => {
  const summary = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/finance-monthly-summary.tsx"), "utf8");
  assert.match(summary, /NEXT_PUBLIC_MYRYRA_FINANCE_TRASH_ENABLED === "true"/);
  assert.match(summary, /entryQuery = entryQuery\.is\("deleted_at", null\)/);
});
