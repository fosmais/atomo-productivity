const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const source = (path) => readFileSync(join(process.cwd(), path), "utf8");

test("standalone lesson migration preserves ownership and linked-journey validation", () => {
  const sql = source("supabase/migrations/20261113090000_mika_teacher_free_lessons.sql");
  assert.match(sql, /ALTER COLUMN journey_id DROP NOT NULL/i);
  assert.match(sql, /FOR INSERT TO authenticated/i);
  assert.match(sql, /auth\.uid\(\)\) = owner_id/i);
  assert.match(sql, /journey_id IS NULL/i);
  assert.match(sql, /j\.owner_id = \(SELECT auth\.uid\(\)\)/i);
  assert.match(sql, /j\.status = 'active'/i);
});

test("session creation supports null journey but still checks linked journey ownership", () => {
  const api = source("src/app/api/mika/lessons/sessions/route.ts");
  assert.match(api, /let journeyId: string \| null = null/);
  assert.match(api, /\.eq\("owner_id", user\.id\)/);
  assert.match(api, /journey_id: journeyId/);
  assert.match(api, /query\.is\("journey_id", null\)/);
});

test("teacher chat resolves server-owned lesson context and persists history", () => {
  const api = source("src/app/api/mika/lessons/chat/route.ts");
  assert.match(api, /\.eq\("owner_id", user\.id\)\.maybeSingle\(\)/);
  assert.match(api, /input\.topic = session\.topic/);
  assert.match(api, /input\.level = session\.level/);
  assert.match(api, /session\.journey_id/);
  assert.match(api, /mika_teacher_messages/);
});

test("teacher interface offers free lessons without requiring a Journey", () => {
  const page = source("src/app/mika-professora/page.tsx");
  assert.match(page, /Aula livre \(sem Journey\)/);
  assert.match(page, /\(!journeyId && !topic\.trim\(\)\)/);
  assert.match(page, /journeyId \? \{ journeyId \} : \{\}/);
});


test("teacher chat enforces MFA, per-user quota and server-only persistence", () => {
  const api = source("src/app/api/mika/lessons/chat/route.ts");
  assert.match(api, /mfa\.getAuthenticatorAssuranceLevel\(\)/);
  assert.match(api, /checkConciergeRateLimit\(user\.id\)/);
  assert.match(api, /status: 429/);
  assert.match(api, /createSupabaseAdmin\(\)/);
  assert.match(api, /\.eq\("session_id", sessionId\)\.eq\("owner_id", user\.id\)/);
  assert.match(api, /progressUpdated: false/);
});
