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

test("non-production worker skips unapproved queued recipients before claiming a lease", () => {
  assert.match(cron, /testRecipients\.includes\(String\(item\.recipient \?\? ""\)\.trim\(\)\.toLowerCase\(\)\)/);
  const skipGuard = cron.indexOf('!testRecipients.includes(String(item.recipient ?? "").trim().toLowerCase())');
  const claim = cron.indexOf('const nextAttempt = Number(item.attempts ?? 0) + 1');
  assert.ok(skipGuard > 0 && skipGuard < claim, "recipient guard must run before incrementing attempts");
});

test("non-production queue filters recipients before applying the batch limit", () => {
  const filter = cron.indexOf('pendingQuery.in("recipient", testRecipients)');
  const limit = cron.indexOf('.limit(10)');
  assert.ok(filter > 0 && limit > filter, "recipient filter must precede LIMIT");
  assert.match(cron, /if \(process\.env\.VERCEL_ENV !== "production"\) pendingQuery = pendingQuery\.in/);
});
