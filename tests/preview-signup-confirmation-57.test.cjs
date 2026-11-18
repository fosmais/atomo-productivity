const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const login = fs.readFileSync(path.join(process.cwd(), "src/app/login/page.tsx"), "utf8");
const confirmation = fs.readFileSync(path.join(process.cwd(), "src/app/auth/confirm/route.ts"), "utf8");

test("signup email confirmation returns to the originating Preview host", () => {
  assert.match(login, /emailRedirectTo: `\$\{window\.location\.origin\}\/auth\/confirm`/);
  assert.doesNotMatch(login, /emailRedirectTo:\s*["']https:\/\/www\.myryra\.com\/auth\/confirm/);
});

test("confirmation endpoint verifies the email token before redirecting", () => {
  assert.match(confirmation, /supabase\.auth\.verifyOtp\(/);
  assert.match(confirmation, /token_hash:\s*tokenHash/);
  assert.match(confirmation, /type,/);
  assert.match(confirmation, /new URL\("\/login\?error=confirm", url\.origin\)/);
  assert.match(confirmation, /new URL\(type === "recovery" \? "\/auth\/reset-password" : "\/dashboard", url\.origin\)/);
});

test("confirmation callback keeps Supabase session cookies on its own response", () => {
  assert.match(confirmation, /createServerClient\(/);
  assert.match(confirmation, /request\.cookies\.getAll\(\)/);
  assert.match(confirmation, /response\.cookies\.set\(name, value, options\)/);
});
