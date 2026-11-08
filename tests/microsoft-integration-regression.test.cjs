const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const connect = read("src/app/api/microsoft/connect/route.ts");
const callback = read("src/app/api/microsoft/callback/route.ts");
const calendar = read("src/app/api/microsoft/calendar/route.ts");
const disconnect = read("src/app/api/microsoft/disconnect/route.ts");
const migration = read("supabase/migrations/20261108190000_microsoft_connections.sql");

test("Microsoft OAuth is disabled unless explicitly enabled", () => {
  for (const source of [connect, callback, calendar, disconnect])
    assert.match(source, /MICROSOFT_INTEGRATION_ENABLED/);
});
test("OAuth requires authenticated user, MFA and PKCE", () => {
  assert.match(connect, /auth\.getUser\(/);
  assert.match(connect, /getAuthenticatorAssuranceLevel/);
  assert.match(connect, /code_challenge_method", "S256"/);
  assert.match(callback, /code_verifier/);
  assert.match(callback, /timingSafeEqual/);
  assert.match(callback, /user\.id !== record\.userId/);
});
test("Calendar is read-only, bounded and rejects off-domain pagination", () => {
  assert.match(calendar, /export async function GET/);
  assert.doesNotMatch(calendar, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.match(calendar, /url\.host !== "graph\.microsoft\.com"/);
  assert.match(calendar, /page < 5/);
  assert.match(calendar, /events\.length >= 300/);
  assert.match(calendar, /MICROSOFT_RECONNECT_REQUIRED/);
});
test("Disconnect checks origin and user ownership", () => {
  assert.match(disconnect, /origin !== new URL\(request\.url\)\.origin/);
  assert.match(disconnect, /\.eq\("user_id", user\.id\)/);
});
test("Microsoft credentials have RLS and no public grants", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.microsoft_connections from anon, authenticated/);
});
