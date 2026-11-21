const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../src/app/api/journeys/[journeyId]/replan-preview/route.ts"),
  "utf8",
);

test("replan preview normalizes accents and whitespace with correct regexes", () => {
  assert.match(source, /replace\(\/\[\\u0300-\\u036f\]\/g, ""\)/);
  assert.match(source, /replace\(\/\\s\+\/g, " "\)/);
  assert.doesNotMatch(source, /replace\(\/\[\\\\u0300-\\\\u036f\]\/g/);
  assert.doesNotMatch(source, /replace\(\/\\\\s\+\/g/);
});

test("preview normalization matches completed titles with accents and repeated spaces", () => {
  const normalizedTitle = (value) => value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
  const completed = new Set(["Lição  de Italiano", "Aprender italiano"].map(normalizedTitle));
  assert.equal(completed.has(normalizedTitle("LICAO DE  ITALIANO")), true);
  assert.equal(completed.has(normalizedTitle("Aprender italiano")), true);
  assert.equal(completed.has(normalizedTitle("Nova missão")), false);
});
