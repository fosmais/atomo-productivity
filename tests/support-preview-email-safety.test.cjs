const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const email = fs.readFileSync(path.join(__dirname, "../src/lib/support/email.ts"), "utf8");
const cron = fs.readFileSync(path.join(__dirname, "../src/app/api/cron/support-email-outbox/route.ts"), "utf8");
const submit = fs.readFileSync(path.join(__dirname, "../src/app/api/support/submit/route.ts"), "utf8");

test("non-production email requires an explicit recipient allowlist", () => {
  assert.match(email, /VERCEL_ENV !== "production"/);
  assert.match(email, /MIKA_SUPPORT_TEST_RECIPIENTS/);
  assert.match(email, /allowed\.includes\(notice\.to\.trim\(\)\.toLowerCase\(\)\)/);
  assert.match(email, /Destinatário não autorizado para homologação/);
});

test("email worker fails closed without authorization or explicit enablement", () => {
  assert.match(cron, /process\.env\.CRON_SECRET/);
  assert.match(cron, /Bearer \$\{secret\}/);
  assert.match(cron, /MIKA_EMAIL_ENABLED !== "true"/);
  assert.match(cron, /!process\.env\.RESEND_API_KEY/);
});

test("email retries retain provider idempotency and lease ownership", () => {
  assert.match(cron, /idempotencyKey: `support-outbox\/\$\{item\.id\}`/);
  assert.match(cron, /processing_started_at", leaseStartedAt/);
  assert.match(cron, /nextAttempt >= 5/);
});

test("support AI remains opt-in, non-billing and subject to legal acceptance", () => {
  assert.match(submit, /authorizeMika && category !== "billing"/);
  assert.match(submit, /hasCurrentLegalAcceptance\(user\.id\)/);
  assert.match(submit, /MIKA_SUPPORT_AI_ENABLED === "true"/);
});

test("non-production cron does not claim messages without configured test recipients", () => {
  assert.match(cron, /VERCEL_ENV !== "production"/);
  assert.match(cron, /MIKA_SUPPORT_TEST_RECIPIENTS/);
  assert.match(cron, /Test recipients not configured/);
  assert.ok(cron.indexOf("Test recipients not configured") < cron.indexOf("const admin = createSupabaseAdmin()"));
});
