const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/myryra-finance-starter.tsx"), "utf8");
const start = source.indexOf("function calculateBalanceCents(");
const end = source.indexOf("\nexport default function", start);
assert.ok(start >= 0 && end > start, "Shared wallet calculator must exist");
const javascript = source.slice(start, end)
  .replace("openingBalanceCents: number, entries: Entry[]): number | null", "openingBalanceCents, entries)");
const calculateBalanceCents = vm.runInNewContext(javascript + "\ncalculateBalanceCents;", {});

const entry = (kind, amount_cents) => ({ kind, amount_cents });
test("calculator applies income and expense in integer cents", () => {
  assert.equal(calculateBalanceCents(10000, [entry("income", 2500), entry("expense", 4300)]), 8200);
  assert.equal(calculateBalanceCents(-1000, [entry("income", 250)]), -750);
  assert.equal(calculateBalanceCents(0, []), 0);
});

test("calculator handles 1200 entries without a 200-record cap", () => {
  const entries = Array.from({ length: 1200 }, (_, i) => entry(i % 3 === 2 ? "income" : "expense", (i + 1) * 137));
  assert.equal(calculateBalanceCents(0, entries), -32797800);
});

test("calculator rejects invalid ledger data and intermediate overflow", () => {
  assert.equal(calculateBalanceCents(0, [entry("expense", 0)]), null);
  assert.equal(calculateBalanceCents(0, [entry("other", 100)]), null);
  assert.equal(calculateBalanceCents(0, [entry("income", 1.5)]), null);
  assert.equal(calculateBalanceCents(Number.MAX_SAFE_INTEGER, [entry("income", 1)]), null);
});
