const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Structural regression guard: the finance balance is currently calculated from
// entries held in client state. A capped initial fetch silently corrupts totals.
const source = fs.readFileSync(
  path.join(__dirname, "..", "src/app/dashboard/myryra-finance-starter.tsx"),
  "utf8"
);

test("finance history is fetched in pages until the last page", () => {
  assert.match(source, /const pageSize = 500;/);
  assert.match(source, /for \(let offset = 0; ; offset \+= pageSize\)/);
  assert.match(source, /\.range\(offset, offset \+ pageSize - 1\)/);
  assert.match(source, /allEntries\.push\(\.\.\.page\)/);
  assert.match(source, /if \(page\.length < pageSize\) break;/);
  assert.match(source, /setEntries\(allEntries\)/);
});

test("finance estimated balance includes every fetched entry and opening balance", () => {
  assert.match(source, /openingBalanceCents \+ entries\.reduce/);
  assert.match(source, /item\.kind === "income" \? item\.amount_cents : -item\.amount_cents/);
  assert.doesNotMatch(source, /\.limit\(200\)/);
});

test("finance renders only 200 recent entries while retaining the complete balance history", () => {
  assert.match(source, /entries\.slice\(0, 200\)\.map\(item =>/);
  assert.match(source, /saldo estimado considera todos os \{entries\.length\} lançamentos carregados/);
  assert.match(source, /setEntries\(allEntries\)/);
});
