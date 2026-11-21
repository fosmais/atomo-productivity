const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const submit = fs.readFileSync(path.join(__dirname, "../src/app/api/support/submit/route.ts"), "utf8");
const worker = fs.readFileSync(path.join(__dirname, "../src/app/api/cron/support-email-outbox/route.ts"), "utf8");
const email = fs.readFileSync(path.join(__dirname, "../src/lib/support/email.ts"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/myka-support.tsx"), "utf8");

test("support submission authenticates, validates, rate limits and stores owner-scoped tickets", () => {
  assert.match(submit, /auth\.getUser\(\)/);
  assert.match(submit, /hourAgo/);
  assert.match(submit, /dayAgo/);
  assert.match(submit, /hourly.count/);
  assert.match(submit, /daily.count/);
  assert.match(submit, /user_id: user\.id/);
  assert.match(submit, /Campos não permitidos/);
  assert.match(submit, /support_email_outbox/);
  assert.match(submit, /event_type: "ticket_created"/);
});

test("MIKA support AI is disabled by default and requires current legal acceptance", () => {
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
});

test("support outbox worker claims atomically and retries with a bounded limit", () => {
  assert.match(worker, /\.eq\("status", "pending"\)\.select\("id"\)\.maybeSingle\(\)/);
  assert.match(worker, /status: "processing"/);
  assert.match(worker, /nextAttempt >= 5/);
  assert.match(worker, /status: terminal \? "failed" : "pending"/);
});

test("support email sender has a timeout and never exposes provider credentials", () => {
  assert.match(email, /AbortSignal\.timeout\(10000\)/);
  assert.match(email, /Falha de comunicação com o provedor de e-mail/);
  assert.doesNotMatch(email, /console\.log\(.*apiKey/);
});

test("support widget sends through the authenticated server route", () => {
  assert.match(client, /fetch\("\/api\/support\/submit"/);
  assert.doesNotMatch(client, /from\("support_tickets"\)\.insert/);
});
