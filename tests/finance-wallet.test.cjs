const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/myryra-finance-starter.tsx"), "utf8");
const section = (start, end) => {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing wallet section: ${start}`);
  return source.slice(a, b);
};

test("wallet refresh commits entries and balance only after both queries succeed", () => {
  const refresh = section("const load = async () => {", "void load();");
  assert.ok(refresh.indexOf("if (balanceError) throw balanceError") < refresh.indexOf("setEntries((data ?? []) as Entry[])"));
  assert.ok(refresh.includes("requestId === latestRequest"));
  assert.ok(refresh.includes("setError(\"\")"));
});

test("wallet operations guard against pending mutations and refreshes", () => {
  assert.ok(section("const addEntry = async", "const saveOpeningBalance = async").includes("if (saving || loading) return"));
  assert.ok(section("const saveOpeningBalance = async", "const deleteEntry = async").includes("if (balanceSaving || loading) return"));
  assert.ok(section("const deleteEntry = async", "return (").includes("if (saving || loading) return"));
  assert.ok(source.includes("disabled={saving || loading} onClick={() => void deleteEntry(item.id)}"));
});

test("wallet retries failed refresh and preserves visible records", () => {
  assert.ok(source.includes("setRefreshAttempt(previous => previous + 1)"));
  assert.ok(source.includes("setError(\"Não foi possível atualizar os dados financeiros."));
  assert.ok(source.includes("window.addEventListener(\"myryra:finance-updated\", refresh)"));
});

test("wallet only publishes confirmed mutations", () => {
  const add = section("const addEntry = async", "const saveOpeningBalance = async");
  assert.ok(add.indexOf("if (!data) throw") < add.indexOf("setEntries(previous => [data as Entry, ...previous])"));
  const balance = section("const saveOpeningBalance = async", "const deleteEntry = async");
  assert.ok(balance.indexOf("if (!savedBalance") < balance.indexOf("setOpeningBalanceCents(cents)"));
});
