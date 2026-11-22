const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const source = (path) => readFileSync(path, "utf8");
const suggest = source("src/app/api/mika-insights/suggest/route.ts");
const transcribe = source("src/app/api/mika-insights/transcribe/route.ts");
const ideas = source("src/app/mika-insights/page.tsx");

test("MIKA Insights API endpoints require an authenticated user", () => {
  for (const route of [suggest, transcribe]) {
    assert.match(route, /supabase\.auth\.getUser\(\)/);
    assert.match(route, /if \([^\n]*!user\)/);
    assert.match(route, /status: 401/);
  }
});

test("MIKA Insights AI calls are quota-gated for the correct actions", () => {
  assert.match(suggest, /rpc\("mika_consume_ai_quota",\s*\{\s*p_action:\s*"suggest"\s*\}\)/);
  assert.match(transcribe, /rpc\("mika_consume_ai_quota",\s*\{\s*p_action:\s*"transcribe"\s*\}\)/);
  for (const route of [suggest, transcribe]) {
    const quota = route.indexOf('rpc("mika_consume_ai_quota"');
    const openai = route.indexOf("new OpenAI(");
    assert.ok(quota >= 0 && openai > quota, "quota must precede OpenAI invocation");
    assert.match(route, /status: 429/);
  }
});

test("MIKA Insights suggestions are scoped to the signed-in owner", () => {
  assert.match(suggest, /\.eq\("id",\s*ideaId\)\.eq\("user_id",\s*user\.id\)/);
  assert.match(suggest, /if \(idea\.status === "archived"\)/);
});

test("MIKA Insights updates and deletion use owner and optimistic concurrency guards", () => {
  assert.match(ideas, /async function setArchived\([\s\S]*?\.eq\("user_id",\s*user\.id\)\.eq\("updated_at",\s*idea\.updated_at\)/);
  assert.match(ideas, /async function updateIdea\([\s\S]*?\.eq\("user_id",\s*user\.id\)\.eq\("updated_at",\s*currentIdea\.updated_at\)/);
  assert.match(ideas, /async function removeIdea\([\s\S]*?\.eq\("user_id",\s*user\.id\)\.eq\("updated_at",\s*currentIdea\.updated_at\)/);
  for (const action of ["setArchived", "updateIdea", "removeIdea"]) {
    assert.match(ideas, new RegExp("async function " + action + "\\([^)]*\\) \\{\\s*if \\(busy\\) return;"));
  }
});


test("MIKA Insights microphone capture cannot overlap active operations", () => {
  assert.match(ideas, /async function startRecording\(\) \{\s*if \(busy \|\| recording \|\| transcribing \|\| microphonePendingRef\.current\) return;/);
  assert.match(ideas, /if \(recorder\.state === "recording"\) recorder\.stop\(\)/);
  assert.match(ideas, /microphonePendingRef\.current = true;/);
  assert.match(ideas, /microphonePendingRef\.current = false;/);
  assert.match(ideas, /setTranscribing\(true\)/);
  assert.match(ideas, /finally \{ setTranscribing\(false\); \}/);
});
