const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/myryra-finance-starter.tsx"), "utf8");
const start = source.indexOf("function parseBRL(");
const end = source.indexOf("\ntype Entry =", start);
assert.ok(start >= 0 && end > start, "Currency parser must be present");
const javascript = source.slice(start, end)
  .replace("input: string): number | null", "input)");
const parseBRL = vm.runInNewContext(javascript + "\nparseBRL;", {});

test("currency parser accepts Brazilian decimal and thousands separators", () => {
  for (const [input, cents] of [["3.999,00",399900],["R$ 1.234,56",123456],["1234.56",123456],["0,01",1],["-10,50",-1050],["1.234.567,89",123456789]]) {
    assert.equal(parseBRL(input), cents, input);
  }
});

test("currency parser rejects invalid amounts and unsafe inputs", () => {
  for (const input of ["", "abc", "12,345", "1e5", "R$ --1", "1000000001,00", "Infinity"]) {
    assert.equal(parseBRL(input), null, input);
  }
});

test("currency parser handles zero explicitly for opening balance", () => {
  assert.equal(parseBRL("0"), 0);
  assert.equal(parseBRL("0,00"), 0);
});
