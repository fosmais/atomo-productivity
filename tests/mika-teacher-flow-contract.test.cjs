const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const read = (path) => readFileSync(join(process.cwd(), path), "utf8");

test("teacher session creation authenticates, validates future schedule and binds owner", () => {
  const src = read("src/app/api/mika/lessons/sessions/route.ts");
  assert.match(src, /supabase\.auth\.getUser\(\)/);
  assert.match(src, /mfa\.getAuthenticatorAssuranceLevel\(\)/);
  assert.match(src, /Date\.parse\(body\.scheduledAt\) < Date\.now\(\) \+ 60000/);
  assert.match(src, /owner_id: user\.id/);
  assert.match(src, /journey_id: journeyId/);
});

test("teacher scheduling is owner-scoped and limited to active lessons", () => {
  const src = read("src/app/api/mika/lessons/schedule/route.ts");
  assert.match(src, /\.update\(\{ scheduled_at: input\.scheduledAt \}\)/);
  assert.match(src, /\.eq\("id", input\.sessionId\)\.eq\("owner_id", user\.id\)\.eq\("status", "active"\)/);
  assert.match(src, /input\.scheduledAt === null/);
  assert.match(src, /mfa\.getAuthenticatorAssuranceLevel\(\)/);
});

test("teacher chat rejects caller history and loads trusted session and history", () => {
  const src = read("src/app/api/mika/lessons/chat/route.ts");
  assert.match(src, /input\.history !== undefined/);
  assert.match(src, /\.eq\("owner_id", user\.id\)\.maybeSingle\(\)/);
  assert.match(src, /session\.status !== "active"/);
  assert.match(src, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(src, /\.limit\(12\)/);
  assert.match(src, /checkConciergeRateLimit\(user\.id\)/);
  assert.match(src, /createSupabaseAdmin\(\)/);
  assert.match(src, /saved: false/);
});

test("teacher interface supports creating, rescheduling and resuming free lessons", () => {
  const src = read("src/app/mika-professora/page.tsx");
  assert.match(src, /Aula livre \(sem Journey\)/);
  assert.match(src, /\/api\/mika\/lessons\/sessions/);
  assert.match(src, /\/api\/mika\/lessons\/schedule/);
  assert.match(src, /\/api\/mika\/lessons\/messages/);
  assert.match(src, /\/api\/mika\/lessons\/chat/);
  assert.match(src, /historyOutOfSync/);
});


test("all teacher endpoints fail closed on preview with wrong Supabase target", () => {
  for (const endpoint of ["chat", "sessions", "schedule", "messages", "delete", "propose"]) {
    const src = read(`src/app/api/mika/lessons/${endpoint}/route.ts`);
    assert.match(src, /process\.env\.VERCEL_ENV !== "preview"/, endpoint);
    assert.match(src, /process\.env\.MIKA_TEACHER_HOMOLOGATION_READY !== "true"/, endpoint);
    assert.match(src, /xanavauqzsrgvdfhcrsm/, endpoint);
    assert.match(src, /if \(previewDatabaseIsUnsafe\(\)\) return NextResponse\.json\(/, endpoint);
    assert.match(src, /status: 503/, endpoint);
  }
});

test("teacher history pagination is bounded, owner-scoped and stable", () => {
  const api = read("src/app/api/mika/lessons/sessions/route.ts");
  const ui = read("src/app/mika-professora/page.tsx");
  assert.match(api, /\.eq\("owner_id", user\.id\)/);
  assert.match(api, /const pageSize = 30/);
  assert.match(api, /\.order\("created_at", \{ ascending: false \}\)\.order\("id", \{ ascending: false \}\)/);
  assert.match(api, /\.range\(start, start \+ pageSize\)/);
  assert.match(api, /nextPage:/);
  assert.match(ui, /Carregar mais aulas/);
  assert.match(ui, /loadMoreHistory/);
  assert.match(ui, /new Set\(current\.map\(\(item\) => item\.id\)\)/);
});
