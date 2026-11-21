const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const submit = fs.readFileSync(path.join(__dirname, "../src/app/api/support/submit/route.ts"), "utf8");
const worker = fs.readFileSync(path.join(__dirname, "../src/app/api/cron/support-email-outbox/route.ts"), "utf8");
const email = fs.readFileSync(path.join(__dirname, "../src/lib/support/email.ts"), "utf8");
const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261121040000_support_outbox_recovery.sql"), "utf8");
const coreMigration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261121030000_support_core_schema.sql"), "utf8");
const serverOnlyMigration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261121050000_support_server_only_ticket_creation.sql"), "utf8");
const atomicMigration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261121060000_support_atomic_ticket_rate_limit.sql"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/myka-support.tsx"), "utf8");

test("support submission authenticates, validates, bounds payload and uses its own throttle", () => {
  assert.match(submit, /auth\.getUser\(\)/);
  assert.match(submit, /rpc\("create_support_ticket_limited"/);
  assert.match(submit, /p_user_id: user\.id/);
  assert.match(submit, /SUPPORT_RATE_LIMIT_EXCEEDED/);
  assert.match(submit, /Campos não permitidos/);
  assert.match(submit, /support_email_outbox/);
  assert.match(submit, /readBoundedJson/);
  assert.match(submit, /bytes > 4096/);
  assert.ok(submit.includes(String.raw`/^\d+$/`), "Content-Length must use a digit regex, not a literal backslash");
  assert.match(submit, /event_type: "ticket_created"/);
  assert.match(submit, /ticket_acknowledgement/);
  assert.match(submit, /user.email_confirmed_at/);
});


test("support core migration reproduces the existing ticket schema with owner RLS and admin audit", () => {
  for (const table of ["support_tickets", "support_admins", "support_ticket_replies", "support_ticket_events", "support_email_outbox"]) {
    assert.match(coreMigration, new RegExp("CREATE TABLE IF NOT EXISTS public\\." + table));
    assert.match(coreMigration, new RegExp("ALTER TABLE public\\." + table + " ENABLE ROW LEVEL SECURITY"));
  }
  assert.match(coreMigration, /Users read own support tickets/);
  assert.match(coreMigration, /REVOKE INSERT, UPDATE, DELETE ON public\.support_tickets FROM authenticated/);
  assert.doesNotMatch(coreMigration, /CREATE POLICY "Users create own support tickets"/);
  assert.match(serverOnlyMigration, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.support_tickets FROM authenticated/);
  assert.match(serverOnlyMigration, /DROP POLICY IF EXISTS "Users create own support tickets"/);
  assert.match(coreMigration, /admin_update_support_ticket/);
  assert.match(coreMigration, /support_ticket_audit/);
  assert.match(coreMigration, /GRANT ALL ON public\.support_tickets/);
});

test("MIKA support AI requires explicit enablement and current legal acceptance", () => {
  assert.match(submit, /MIKA_SUPPORT_AI_ENABLED === "true"/);
  assert.match(submit, /hasCurrentLegalAcceptance\(user\.id\)/);
  assert.match(submit, /OPENAI_API_KEY/);
  assert.match(submit, /\[\[ESCALATE\]\]/);
  assert.match(submit, /p_authorize_mika: authorizeMika/);
  assert.match(submit, /input\.authorizeMika === true && category !== "billing"/);
  assert.match(submit, /&& authorizeMika && category !== "billing"/);
  assert.match(client, /checked=\{authorizeMika\}/);
  assert.doesNotMatch(submit, /myka_authorized: true/);
  assert.match(submit, /author_type: "myka"/);
  assert.doesNotMatch(submit, /\.update\(\{ status: "in_progress" \}\)/);
  assert.match(submit, /category !== "billing"/);
  assert.match(submit, /if \(!legalReady\) throw new Error/);
});

test("support email worker requires cron secret and explicit email enablement", () => {
  assert.match(worker, /authorization.*Bearer/);
  assert.match(worker, /CRON_SECRET/);
  assert.match(worker, /MIKA_EMAIL_ENABLED !== "true"/);
  assert.match(worker, /RESEND_API_KEY/);
  assert.match(worker, /ticket_acknowledgement/);
  assert.match(worker, /support-outbox\/\$\{item\.id\}/);
});

test("support outbox worker claims atomically, recovers stale claims and retries at most five times", () => {
  assert.match(worker, /claim\.select\("id"\)\.maybeSingle\(\)/);
  assert.match(worker, /status\.eq\.pending/);
  assert.match(worker, /status: "processing"/);
  assert.match(worker, /processing_started_at/);
  assert.match(worker, /10 \* 60 \* 1000/);
  assert.match(worker, /nextAttempt >= 5/);
  assert.match(worker, /nextAttempt > 5/);
  assert.match(worker, /Limite de tentativas excedido/);
  assert.match(worker, /exhausted = exhausted\.eq\("processing_started_at", item\.processing_started_at\)/);
  assert.match(worker, /status: terminal \? "failed" : "pending"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS processing_started_at timestamptz/);
  assert.match(migration, /WHERE status = .processing./);
  assert.match(migration, /ticket_acknowledgement/);
});

test("support email sender uses Resend idempotency, timeout and safe error handling", () => {
  assert.match(email, /AbortSignal\.timeout\(10000\)/);
  assert.match(email, /Idempotency-Key/);
  assert.match(email, /Falha de comunicação com o provedor de e-mail/);
  assert.doesNotMatch(email, /console\.log\(.*apiKey/);
});

test("support widget sends through the authenticated server route", () => {
  assert.match(client, /fetch\("\/api\/support\/submit"/);
  assert.match(client, /reply\.author_type === "myka"/);
  assert.match(client, /foi colocada na fila de e-mails/);
  assert.doesNotMatch(client, /from\("support_tickets"\)\.insert/);
  assert.match(client, /setSelectedTicket\(null\);\s*void loadTickets\(\);\s*void viewReplies\(result\.ticket\.id\)/);
});

test('email outbox completion is scoped to the active worker lease', () => {
  const worker = fs.readFileSync(path.join(__dirname, '../src/app/api/cron/support-email-outbox/route.ts'), 'utf8');
  assert.match(worker, /const leaseStartedAt = new Date\(\)\.toISOString\(\)/);
  assert.match(worker, /processing_started_at: leaseStartedAt/);
  assert.equal((worker.match(/\.eq\("processing_started_at", leaseStartedAt\)/g) || []).length, 2);
});

test('support ticket rate limit is transaction-atomic and server-only', () => {
  assert.match(atomicMigration, /pg_advisory_xact_lock/);
  assert.match(atomicMigration, /SECURITY INVOKER/);
  assert.doesNotMatch(atomicMigration, /SECURITY DEFINER/);
  assert.doesNotMatch(atomicMigration, /FROM auth\.users/);
  assert.match(atomicMigration, /REVOKE ALL ON public\.support_tickets FROM anon, authenticated/);
  assert.match(atomicMigration, /GRANT SELECT ON public\.support_tickets TO authenticated/);
  assert.match(atomicMigration, /v_hour_count >= 5 OR v_day_count >= 10/);
  assert.match(atomicMigration, /SUPPORT_RATE_LIMIT_EXCEEDED/);
  assert.match(atomicMigration, /REVOKE ALL ON FUNCTION public\.create_support_ticket_limited.*FROM PUBLIC, anon, authenticated/);
  assert.match(atomicMigration, /GRANT EXECUTE ON FUNCTION public\.create_support_ticket_limited.*TO service_role/);
  assert.doesNotMatch(submit, /from\("support_tickets"\)\.insert/);
});

test("homologation preflight verifies full application baseline without mutating data", () => {
  const preflight = fs.readFileSync(
    path.join(__dirname, "../docs/mvp2/support-homologation-baseline-preflight.sql"),
    "utf8"
  );
  for (const table of [
    "events", "tasks", "plans", "myryra_finance_entries",
    "myryra_journeys", "mika_teacher_sessions",
    "support_tickets", "support_email_outbox",
  ]) {
    assert.match(preflight, new RegExp("\\b" + table + "\\b"));
  }
  assert.match(preflight, /supabase_migrations\.schema_migrations/);
  assert.match(preflight, /relrowsecurity/);
  assert.doesNotMatch(preflight, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE)\s+(?:TABLE|FROM|INTO|public\.)/i);
});
