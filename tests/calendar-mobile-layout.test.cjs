const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const calendar = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/calendar-events.tsx"), "utf8");
const reminder = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/event-reminder-control.tsx"), "utf8");

test("event header reserves space for favorite and stacks details on mobile", () => {
  assert.match(calendar, /absolute right-3 top-2 z-10/);
  assert.match(calendar, /list-none rounded-md py-1 pr-12/);
  assert.match(calendar, /flex-col items-start gap-2 sm:flex-row/);
});

test("expanded event actions stay within a responsive card", () => {
  assert.match(calendar, /grid min-w-0 grid-cols-1 gap-3 border-t border-slate-800/);
  assert.match(calendar, /sm:grid-cols-2/);
  assert.match(calendar, /min-w-0 sm:col-span-2"><EventReminderControl/);
  assert.match(calendar, /basis-full rounded-lg border border-violet-400\/50/);
  assert.match(calendar, /sm:basis-auto sm:flex-1/);
});

test("reminder controls wrap within available mobile width", () => {
  assert.match(reminder, /w-full min-w-0 rounded-lg border/);
  assert.match(reminder, /flex min-w-0 flex-col items-stretch gap-2/);
  assert.match(reminder, /min-h-11 min-w-0 max-w-full/);
});
