const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/calendar-events.tsx"), "utf8");
const start = source.indexOf("function downloadConciergeReminder(");
const end = source.indexOf("const [travelByEvent", start);
assert.ok(start >= 0 && end > start);
const reminder = source.slice(start, end);

test("Concierge reminder rejects invalid or reversed appointment times", () => {
  assert.ok(reminder.includes("Date.parse(event.endsAt) <= Date.parse(event.startsAt)"));
  assert.ok(reminder.indexOf("Date.parse(event.endsAt) <= Date.parse(event.startsAt)") < reminder.indexOf("const blob = new Blob"));
});

test("Concierge reminder uses whole minutes and bounded travel buffer", () => {
  assert.ok(reminder.includes("Number.isInteger(travelMinutes)"));
  assert.ok(reminder.includes("Number.isInteger(bufferMinutes)"));
  assert.ok(reminder.includes("bufferMinutes > 180"));
});
