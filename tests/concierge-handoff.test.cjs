const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const calendar = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/calendar-events.tsx"), "utf8");
const chat = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/copilot-chat.tsx"), "utf8");

test("calendar passes a bounded concierge prompt to MIKA", () => {
  assert.match(calendar, /sessionStorage\.setItem\("myryra:myka:concierge-handoff", prompt\.slice\(0, 3500\)\)/);
  assert.match(calendar, /navigateTo\("vyra-ai"\)/);
});
test("MIKA receives the full handoff and clears its pending storage entry", () => {
  assert.match(chat, /sessionStorage\.getItem\("myryra:myka:concierge-handoff"\)/);
  assert.match(chat, /sessionStorage\.removeItem\("myryra:myka:concierge-handoff"\)/);
  assert.match(chat, /setPendingConciergePrompt\(prompt\.slice\(0, 3500\)\)/);
});
test("failed chat requests preserve the draft without duplicate messages", () => {
  assert.match(chat, /setMessages\(previous => previous\.slice\(0, -1\)\)/);
  assert.match(chat, /setInput\(content\)/);
  assert.match(chat, /if \(!pendingConciergePrompt \|\| historyLoading \|\| loading \|\| error/);
});

test("departure reminder requires a measured or manually entered duration", () => {
  assert.match(calendar, /disabled=\{!travelByEvent\[event\.id\]\}/);
  assert.match(calendar, /if \(travel\) downloadConciergeReminder\(event, travel\.minutes/);
  assert.match(calendar, /if \(raw === ""\) \{ setTravelByEvent/);
  assert.doesNotMatch(calendar, /travelByEvent\[event\.id\]\?\.minutes \?\? 30/);
});

test("route estimates reject invalid duration and timestamp before scheduling", () => {
  assert.match(calendar, /Number\.isFinite\(data\.durationSeconds\)/);
  assert.match(calendar, /data\.durationSeconds <= 0/);
  assert.match(calendar, /data\.durationSeconds > 480 \* 60/);
  assert.match(calendar, /Number\.isFinite\(Date\.parse\(data\.calculatedAt\)\)/);
});
