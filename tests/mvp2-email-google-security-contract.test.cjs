const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("support email uses server-side Resend credentials and verified sender", () => {
  const source = read("src/lib/support/email.ts");
  assert.match(source, /process\.env\.RESEND_API_KEY/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_RESEND_API_KEY/);
  assert.match(source, /https:\/\/api\.resend\.com\/emails/);
  assert.match(source, /support@myryra\.com/);
  assert.match(source, /if\s*\(!apiKey\)\s*return\s*\{\s*sent:\s*false/);
  assert.match(source, /if\s*\(!response\.ok\)\s*return\s*\{\s*sent:\s*false/);
});

test("Google OAuth checks state, signed-in owner and granted write scope", () => {
  const connect = read("src/app/api/google/connect/route.ts");
  const callback = read("src/app/api/google/callback/route.ts");
  assert.match(connect, /randomBytes\(32\)/);
  assert.match(connect, /httpOnly:\s*true/);
  assert.match(connect, /sameSite:\s*"lax"/);
  assert.match(callback, /timingSafeEqual/);
  assert.match(callback, /user\.id\s*!==\s*expectedState\.userId/);
  assert.match(callback, /expectedState\.writeRequested\s*===\s*true/);
  assert.match(callback, /write_permission_denied/);
  assert.match(callback, /encryptGoogleToken\(tokens\.refresh_token\)/);
});
