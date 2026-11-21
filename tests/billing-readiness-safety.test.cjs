const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const readiness = fs.readFileSync(path.join(__dirname, "../src/app/api/billing/checkout/readiness/route.ts"), "utf8");
const checkout = fs.readFileSync(path.join(__dirname, "../src/app/api/billing/checkout/route.ts"), "utf8");

test("readiness requires authenticated user and MFA assurance", () => {
  assert.match(readiness, /supabase\.auth\.getUser\(\)/);
  assert.match(readiness, /status: 401/);
  assert.match(readiness, /getAuthenticatorAssuranceLevel\(\)/);
  assert.match(readiness, /MFA_REQUIRED/);
});

test("checkout readiness remains sandbox-only and cannot activate payments", () => {
  assert.match(readiness, /process\.env\.ASAAS_ENVIRONMENT === "sandbox"/);
  assert.match(readiness, /checkoutAvailable: false/);
  assert.match(readiness, /paymentActivationEnabled: false/);
  assert.match(readiness, /reason: "sandbox_only"/);
  assert.match(readiness, /"Cache-Control": "private, no-store"/);
});

test("checkout endpoint is not silently made available by readiness", () => {
  assert.ok(checkout.length > 0);
  assert.doesNotMatch(readiness, /\.from\([^)]*\)\.(?:insert|update|upsert|delete)\(/);
});
