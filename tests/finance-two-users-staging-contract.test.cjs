const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(path.join(__dirname, "../scripts/finance-two-users-staging.cjs"), "utf8");
const workflow = fs.readFileSync(path.join(__dirname, "../.github/workflows/finance-two-users-staging.yml"), "utf8");

test("Finance staging harness is pinned to the isolated Supabase project and rejects privileged keys", () => {
  assert.match(script, /MYRYRA_FINANCE_STAGING_URL !== STAGING_URL/);
  assert.match(script, /xanavauqzsrgvdfhcrsm\.supabase\.co/);
  assert.match(script, /startsWith\("sb_secret_"/);
  assert.match(script, /myryra-finance-test/);
  assert.doesNotMatch(script, /SUPABASE_SERVICE_ROLE_KEY|service_role_key/i);
});

test("Finance staging integration verifies two distinct authenticated synthetic users", () => {
  assert.match(script, /signInWithPassword/);
  assert.match(script, /assert\.notEqual\(a\.user\.id, b\.user\.id/);
  assert.match(script, /cross-user entry SELECT/);
  assert.match(script, /cross-user subscription SELECT/);
  assert.match(script, /cross-user entry UPDATE/);
  assert.match(script, /cross-user subscription UPDATE/);
});

test("Finance staging integration exercises owner edits, soft delete and restore", () => {
  assert.match(script, /amount_cents: 2345/);
  assert.match(script, /deleted_at: deletedAt/);
  assert.match(script, /\.is\("deleted_at", null\)/);
  assert.match(script, /\.not\("deleted_at", "is", null\)/);
  assert.match(script, /deleted_at: null/);
  assert.match(script, /finally/);
});

test("Finance RLS workflow is manual, staging-only and uses only synthetic Auth secrets", () => {
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /environment: staging/);
  assert.match(workflow, /MYRYRA_FINANCE_STAGING_ANON_KEY/);
  assert.match(workflow, /FINANCE_TEST_OTHER_PASSWORD/);
  assert.match(workflow, /node scripts\/finance-two-users-staging\.cjs/);
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY|PRODUCTION/);
});
