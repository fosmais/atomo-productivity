const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const source = (path) => readFileSync(join(process.cwd(), path), "utf8");
const page = source("src/app/mika-insights/page.tsx");
const suggest = source("src/app/api/mika-insights/suggest/route.ts");
const transcribe = source("src/app/api/mika-insights/transcribe/route.ts");

test("MIKA Insights UI reads only current user's ideas", () => {
  assert.match(page, /auth\.getUser\(\)/);
  assert.match(page, /\.eq\("user_id", user\.id\)/);
  assert.match(page, /\.from\("mika_ideas"\)/);
});

test("suggestion API authenticates and scopes the selected idea", () => {
  assert.match(suggest, /auth\.getUser\(\)/);
  assert.match(suggest, /\.eq\("user_id", user\.id\)/);
  assert.match(suggest, /mika_consume_ai_quota/);
  assert.match(suggest, /maxRetries: 0/);
  assert.match(suggest, /totalBytes > 4096/);
});

test("transcription API authenticates, limits upload size and consumes quota", () => {
  assert.match(transcribe, /auth\.getUser\(\)/);
  assert.match(transcribe, /mika_consume_ai_quota/);
  assert.match(transcribe, /receivedBytes > 11 \* 1024 \* 1024/);
  assert.match(transcribe, /audio\.size < 1 \|\| audio\.size > 10 \* 1024 \* 1024/);
});

test("AI routes do not use elevated Supabase service credentials", () => {
  for (const route of [suggest, transcribe]) {
    assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY|service_role/);
    assert.match(route, /createClient\(\)/);
  }
});

test("mutations scope writes to owner and use optimistic concurrency", () => {
  const updates = [...page.matchAll(/\.update\(\{/g)].length;
  assert.equal(updates, 3, "archive, plan and edit must all be guarded");
  const guards = [...page.matchAll(/\.eq\("updated_at", (?:idea|currentIdea)\.updated_at\)/g)].length;
  assert.equal(guards, 4, "archive, plan, edit and delete must check current version");
  const ownerGuards = [...page.matchAll(/\.eq\("user_id", user\.id\)/g)].length;
  assert.ok(ownerGuards >= 5, "read and every write must scope to the signed-in user");
  assert.match(page, /\.delete\(\)\.eq\("id", id\)\.eq\("user_id", user\.id\)/);
});

test("suggestion API rejects archived ideas and never creates tasks automatically", () => {
  assert.match(suggest, /idea\.status === "archived"/);
  assert.doesNotMatch(suggest, /\.from\("tasks"\)\.insert\(/);
  assert.match(page, /Nenhuma tarefa foi criada automaticamente/);
});
