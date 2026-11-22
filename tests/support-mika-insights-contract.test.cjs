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
