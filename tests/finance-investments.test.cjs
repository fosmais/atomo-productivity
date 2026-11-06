const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/finance-investments.tsx"), "utf8");
const match = source.match(/const number = \(input: string\) => \{[\s\S]*?\n\};/);
assert.ok(match, "Investment amount parser must exist");
const parse = vm.runInNewContext(match[0].replace("(input: string)", "(input)").replace("let normalized: string;", "let normalized;") + "\nnumber");

test("investment simulator accepts pt-BR amounts", () => {
  assert.equal(parse("1.000,50"), 1000.5);
  assert.equal(parse("1000,50"), 1000.5);
  assert.equal(parse("R$ 1.000,50"), 1000.5);
  assert.equal(parse("1,000.50"), 1000.5);
});
test("investment simulator rejects empty or malformed amounts", () => {
  for (const value of ["", "  ", "1.2.3", "-1", "12,3456", "abc"]) {
    assert.ok(Number.isNaN(parse(value)), value);
  }
});

test("MIKA handoff uses formatted numeric values", () => {
  assert.ok(source.includes("format(number(initial))"));
  assert.ok(source.includes("format(number(monthly))"));
  assert.ok(source.includes("disabled={!result}"));
});

test("investment goals are passed to MIKA when valid", () => {
  assert.ok(source.includes("goalContext"));
  assert.ok(source.includes("result.goalProgress !== null"));
  assert.ok(source.includes("prompt + goalContext"));
});
