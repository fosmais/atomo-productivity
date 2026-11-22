const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const login = readFileSync(join(root, "src/app/login/page.tsx"), "utf8");
const confirmation = readFileSync(join(root, "src/app/auth/confirm/route.ts"), "utf8");
const recovery = readFileSync(join(root, "src/app/auth/recovery-callback/route.ts"), "utf8");

test("email signup confirmation stays on the current deployment origin", () => {
  assert.match(login, /emailRedirectTo:\s*`\$\{window\.location\.origin\}\/auth\/confirm`/);
  assert.doesNotMatch(login, /emailRedirectTo:\s*["']https:\/\/www\.myryra\.com/);
});

test("password recovery callback stays on the current deployment origin", () => {
  assert.match(login, /redirectTo:\s*`\$\{window\.location\.origin\}\/auth\/recovery-callback`/);
  assert.doesNotMatch(login, /redirectTo:\s*["']https:\/\/www\.myryra\.com\/auth\/recovery-callback/);
});

test("auth callbacks redirect relative to the incoming request origin", () => {
  assert.match(confirmation, /new URL\([^\n]+, url\.origin\)/);
  assert.match(recovery, /new URL\([^\n]+, url\.origin\)/);
});
