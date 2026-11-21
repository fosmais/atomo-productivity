const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const submit = fs.readFileSync(path.join(__dirname, "../src/app/api/support/submit/route.ts"), "utf8");
const worker = fs.readFileSync(path.join(__dirname, "../src/app/api/cron/support-email-outbox/route.ts"), "utf8");
const email = fs.readFileSync(path.join(__dirname, "../src/lib/support/email.ts"), "utf8");
const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261121040000_support_outbox_recovery.sql"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/myka-support.tsx"), "utf8");

test("support submission authenticates, validates, bounds payload and uses its own throttle", () => {
  assert.match(submit, /auth\.getUser\(\)/);
  assert.match(submit, /hourAgo/);
  assert.match(submit, /dayAgo/);
  assert.match(submit, /hourly.count/);
  assert.match(submit, /daily.count/);
  assert.match(submit, /user_id: user\.id/);
  assert.match(submit, /Campos não permitidos/);
  assert.match(submit, /support_email_outbox/);
  assert.match(submit, /readBoundedJson/);
  assert.match(submit, /bytes > 4096/);
  assert.match(submit, /event_type: "ticket_created"/);
});

test("MIKA support AI requires explicit enablement and current legal acceptance", () => {
  assert.match(submit, /MIKA_SUPPORT_AI_ENABLED === "true"/);
  assert.match(submit, /hasCurrentLegalAcceptance\(user\.id\)/);
  assert.match(submit, /OPENAI_API_KEY/);
  assert.match(submit, /\[\[ESCALATE\]\]/);
  assert.match(submit, /myka_authorized: true/);
  assert.match(submit, /author_type: "myka"/);
});

test("support email worker requires cron secret and explicit email enablement", () => {
  assert.match(worker, /authorization.*Bearer/);
  assert.match(worker, /CRON_SECRET/);
  assert.match(worker, /MIKA_EMAIL_ENABLED !== "true"/);
  assert.match(worker, /RESEND_API_KEY/);
  assert.match(worker, /support-outbox\/\$\{item\.id\}/);
});

test("support outbox worker claims atomically, recovers stale claims and retries at most five times", () => {
  assert.match(worker, /claim\.select\("id"\)\.maybeSingle\(\)/);
  assert.match(worker, /status\.eq\.pending/);
  assert.match(worker, /status: "processing"/);
  assert.match(worker, /processing_started_at/);
  assert.match(worker, /10 \* 60 \* 1000/);
  assert.match(worker, /nextAttempt >= 5/);
  assert.match(worker, /status: terminal \? "failed" : "pending"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS processing_started_at timestamptz/);
  assert.match(migration, /WHERE status = .processing./);
});

test("support email sender uses Resend idempotency, timeout and safe error handling", () => {
  assert.match(email, /AbortSignal\.timeout\(10000\)/);
  assert.match(email, /Idempotency-Key/);
  assert.match(email, /Falha de comunicação com o provedor de e-mail/);
  assert.doesNotMatch(email, /console\.log\(.*apiKey/);
});

test("support widget sends through the authenticated server route", () => {
  assert.match(client, /fetch\("\/api\/support\/submit"/);
  assert.doesNotMatch(client, /from\("support_tickets"\)\.insert/);
});
