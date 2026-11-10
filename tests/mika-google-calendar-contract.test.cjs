const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Google write permission is opt-in, not added to the default read scopes", () => {
  const scopes = read("src/lib/google-calendar.ts");
  const connect = read("src/app/api/google/connect/route.ts");
  assert.doesNotMatch(scopes, /"https:\/\/www\.googleapis\.com\/auth\/calendar\.events"/);
  assert.match(connect, /allow_event_creation/);
  assert.match(connect, /writeRequested \? \[\.\.\.GOOGLE_CALENDAR_SCOPES/);
});

test("Google write callback checks granted scopes", () => {
  const callback = read("src/app/api/google/callback/route.ts");
  assert.match(callback, /writeRequested === true/);
  assert.match(callback, /tokens\.scope\?\.split/);
  assert.match(callback, /write_permission_denied/);
});

test("Review event creation requires session, consent, and idempotent event IDs", () => {
  const route = read("src/app/api/google/events/create/route.ts");
  assert.match(route, /request\.headers\.get\("origin"\)/);
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /getAuthenticatorAssuranceLevel\(\)/);
  assert.match(route, /getTokenInfo\(refreshed\.token\)/);
  assert.match(route, /tokenInfo\.scopes\.includes\(WRITE_SCOPE\)/);
  assert.match(route, /createHash\("sha256"\)/);
  assert.match(route, /status !== 409/);
});

test("Calendar selection does not silently create Google events", () => {
  const ui = read("src/app/journey/mika-review-calendar.tsx");
  assert.match(ui, /destination === "google"/);
  assert.match(ui, /\/api\/google\/events\/create/);
  assert.match(ui, /onClick=\{\(\) => void confirm\(\)\}/);
  assert.match(ui, /GOOGLE_CALENDAR_RECONNECT_REQUIRED/);
});
