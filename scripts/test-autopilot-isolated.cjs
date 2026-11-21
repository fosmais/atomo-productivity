#!/usr/bin/env node
/**
 * Isolated Supabase functional smoke tests for reserve_autopilot_task.
 * Run ONLY against a dedicated disposable Supabase test project.
 * Requires two real authenticated user JWTs and an existing test task owned by A.
 * No service-role key is accepted; no production project is allowed.
 *
 * TEST_SUPABASE_URL=https://<test-project>.supabase.co
 * TEST_SUPABASE_ANON_KEY=...
 * TEST_USER_A_JWT=...
 * TEST_USER_B_JWT=...
 * TEST_USER_A_TASK_ID=<uuid>  (pending, duration_minutes=25, not deleted)
 * TEST_EXPECTED_PROJECT_REF=<dedicated-test-project-ref>
 * TEST_ALLOW_WRITES_IN_ISOLATED_PROJECT=YES
 * node scripts/test-autopilot-isolated.cjs
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const assert = require("node:assert/strict");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require("@supabase/supabase-js");

const env = process.env;
const required = ["TEST_SUPABASE_URL", "TEST_SUPABASE_ANON_KEY", "TEST_USER_A_JWT", "TEST_USER_B_JWT", "TEST_USER_A_TASK_ID", "TEST_EXPECTED_PROJECT_REF"];
for (const name of required) {
  if (!env[name]) throw new Error("Missing isolated test configuration: " + name);
}
const url = new URL(env.TEST_SUPABASE_URL);
assert.equal(url.protocol, "https:", "HTTPS required");
assert.match(url.hostname, /^[a-z0-9-]+\.supabase\.co$/, "Supabase project URL required");
assert.notEqual(url.hostname, "qothgddrvrpeqsprslqk.supabase.co", "Active MYRYRA project is forbidden");
assert.match(env.TEST_EXPECTED_PROJECT_REF, /^[a-z0-9-]+$/, "Invalid test project ref");
assert.equal(url.hostname, env.TEST_EXPECTED_PROJECT_REF + ".supabase.co", "Target does not match explicitly approved test project");
assert.equal(env.TEST_ALLOW_WRITES_IN_ISOLATED_PROJECT, "YES", "Explicit test-write opt-in required");
assert.match(env.TEST_USER_A_TASK_ID, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
function jwtClaims(token, label) {
  const parts = token.split(".");
  assert.equal(parts.length, 3, label + " must be a JWT");
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  assert.equal(claims.role, label === "anon key" ? "anon" : "authenticated", label + " must not be privileged");
  assert.ok(typeof claims.exp === "number" && claims.exp > Date.now() / 1000, label + " must not be expired");
  if (claims.iss) {
    assert.ok(claims.iss.startsWith(url.origin + "/auth/v1"), label + " issuer must match test project");
  }
  return claims;
}
jwtClaims(env.TEST_SUPABASE_ANON_KEY, "anon key");
const claimsA = jwtClaims(env.TEST_USER_A_JWT, "user A");
const claimsB = jwtClaims(env.TEST_USER_B_JWT, "user B");
assert.ok(claimsA.sub && claimsB.sub && claimsA.sub !== claimsB.sub, "Distinct test users required");


function client(jwt) {
  return createClient(url.origin, env.TEST_SUPABASE_ANON_KEY, {
    global: { headers: jwt ? { Authorization: "Bearer " + jwt } : {} },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
const a = client(env.TEST_USER_A_JWT);
const b = client(env.TEST_USER_B_JWT);
const guest = client();
const taskId = env.TEST_USER_A_TASK_ID;
const results = [];
async function run(id, fn) {
  try { await fn(); results.push({ id, status: "PASS" }); }
  catch (err) { results.push({ id, status: "FAIL", reason: err.message }); }
}
async function reserve(c, start, end) {
  return c.rpc("reserve_autopilot_task", {
    p_task_id: taskId, p_start: start.toISOString(), p_end: end.toISOString(),
  });
}
async function countA(task) {
  const { data, error } = await a.from("events").select("id").eq("notes", "Tarefa MYRYRA: " + task);
  if (error) throw new Error("Cannot verify A's events: " + error.code);
  return data.length;
}
(async () => {
  const { data: task, error: taskError } = await a.from("tasks")
    .select("id,user_id,duration_minutes,completed,deleted_at").eq("id", taskId).single();
  assert.ifError(taskError);
  assert.equal(task.duration_minutes, 25, "Test task must be exactly 25 minutes");
  assert.equal(task.completed, false);
  assert.equal(task.deleted_at, null);
  const { data: identityA, error: errA } = await a.auth.getUser(env.TEST_USER_A_JWT);
  const { data: identityB, error: errB } = await b.auth.getUser(env.TEST_USER_B_JWT);
  assert.ifError(errA); assert.ifError(errB);
  assert.notEqual(identityA.user.id, identityB.user.id);
  assert.equal(task.user_id, identityA.user.id);

  // Use future unique slot (start ~5 days out) to reduce clashes with test fixtures.
  const start = new Date(Date.now() + 5 * 86400000);
  start.setUTCHours(13, 0, 0, 0);
  const end = new Date(start.getTime() + 25 * 60000);
  const before = await countA(taskId);

  await run("AF-01 cross-account ownership", async () => {
    const { error } = await reserve(b, start, end);
    assert.ok(error, "B unexpectedly reserved A's task");
    assert.equal(await countA(taskId), before);
  });
  await run("AF-02 unauthenticated", async () => {
    const { error } = await reserve(guest, start, end);
    assert.ok(error, "Guest unexpectedly reserved a task");
    assert.equal(await countA(taskId), before);
  });
  await run("AF-03 concurrent reservation", async () => {
    const outcomes = await Promise.all([reserve(a, start, end), reserve(a, start, end)]);
    assert.equal(outcomes.filter((x) => !x.error).length, 1, "Expected exactly one successful RPC");
    assert.equal(outcomes.filter((x) => x.error).length, 1, "Expected one rejected RPC");
    assert.equal(await countA(taskId), before + 1);
  });
  await run("AF-10 duplicate reservation", async () => {
    const { error } = await reserve(a, start, end);
    assert.ok(error, "Duplicate reservation was accepted");
    assert.equal(await countA(taskId), before + 1);
  });

  // Do not delete automatically: preserves evidence in isolated environment.
  // Never print tokens, emails, UUIDs or other user data.
  for (const item of results) console.log(item.id + ": " + item.status + (item.reason ? " (" + item.reason + ")" : ""));
  if (results.some((x) => x.status === "FAIL")) process.exitCode = 1;
})().catch((err) => {
  console.error("Preflight failed: " + err.message);
  process.exitCode = 1;
});
