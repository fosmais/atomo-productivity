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
test("MIKA bounds the handoff to the API limit and clears pending storage", () => {
  assert.match(chat, /sessionStorage\.getItem\("myryra:myka:concierge-handoff"\)/);
  assert.match(chat, /sessionStorage\.removeItem\("myryra:myka:concierge-handoff"\)/);
  assert.match(chat, /setPendingConciergePrompt\(prompt\.slice\(0, 1500\)\)/);
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

test("concierge persistence validates departure and selected services", () => {
  const cloud = fs.readFileSync(path.join(__dirname, "../src/lib/event-cloud.ts"), "utf8");
  assert.match(cloud, /typeof event\.concierge\.departureAddress !== "string"/);
  assert.match(cloud, /!Array\.isArray\(event\.concierge\.services\)/);
  assert.match(cloud, /event\.concierge\.services\.length > 4/);
  assert.match(cloud, /event\.concierge\.services\.some\(service => !\["transport", "parking", "restaurant", "hotel"\]\.includes\(service\)\)/);
});

test("loaded concierge preferences are sanitized before display", () => {
  const cloud = fs.readFileSync(path.join(__dirname, "../src/lib/event-cloud.ts"), "utf8");
  assert.match(cloud, /Array\.isArray\(item\.services\)/);
  assert.match(cloud, /item\.services\.filter\(/);
  assert.match(cloud, /typeof item\.departure_address === "string"/);
});

test("calendar event loading is not blocked by optional favorites", () => {
  assert.match(calendar, /setEvents\(result\);\s*\/\/ Favorites are optional metadata/);
  assert.match(calendar, /try \{\s*await loadFavoriteEvents\(\);\s*\} catch \{\s*setFavoriteEventIds\(\[\]\)/);
});

test("initial calendar load clears stale favorites if the optional lookup fails", () => {
  assert.match(calendar, /getCloudEvents\(\)\s*\.then\(\(result\) => \{/);
  assert.match(calendar, /loadFavoriteEvents\(\)\.catch\(\(\) => \{ if \(active\) setFavoriteEventIds\(\[\]\); \}\)/);
});

test("background refresh does not erase unrelated calendar errors", () => {
  assert.match(calendar, /void loadEvents\(\)\.catch\(\(\) =>\s*setError\("Não foi possível atualizar os compromissos\."\)/);
  assert.doesNotMatch(calendar, /loadEvents\(\)\.then\(\(\) => setError\(""\)\)/);
});

test("calendar export refuses invalid travel time and event dates", () => {
  assert.match(calendar, /!Number\.isFinite\(travelMinutes\)/);
  assert.match(calendar, /travelMinutes <= 0 \|\| travelMinutes > 480/);
  assert.match(calendar, /!Number\.isFinite\(Date\.parse\(event\.startsAt\)\)/);
  assert.match(calendar, /Não foi possível criar o alerta: confira os horários/);
});

test("route API rejects impossible provider durations before responding", () => {
  const route = fs.readFileSync(path.join(__dirname, "../src/app/api/concierge/route/route.ts"), "utf8");
  assert.match(route, /seconds <= 0 \|\| seconds > 480 \* 60/);
  assert.match(route, /Number\.isFinite\(seconds\)/);
});

test("route API does not expose malformed provider distance", () => {
  const route = fs.readFileSync(path.join(__dirname, "../src/app/api/concierge/route/route.ts"), "utf8");
  assert.match(route, /Number\.isFinite\(route\.distanceMeters\)/);
  assert.match(route, /route\.distanceMeters >= 0 \? route\.distanceMeters : null/);
});

test("route lookup times out and offers manual fallback", () => {
  assert.match(calendar, /signal: AbortSignal\.timeout\(10000\)/);
  assert.match(calendar, /Consulta indisponível\. Informe o tempo de trajeto manualmente/);
});

test("calendar renders only finite nonnegative route distances", () => {
  assert.match(calendar, /Number\.isFinite\(data\.distanceMeters\)/);
  assert.match(calendar, /data\.distanceMeters >= 0 \? data\.distanceMeters : null/);
});
