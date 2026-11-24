const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const api = fs.readFileSync(path.join(__dirname, "../src/app/api/internal/staging-bootstrap/route.ts"), "utf8");
const page = fs.readFileSync(path.join(__dirname, "../src/app/internal/staging-bootstrap/page.tsx"), "utf8");
const dashboard = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/page.tsx"), "utf8");

test("staging bootstrap API fails closed outside Preview", () => {
  assert.match(api, /process\.env\.VERCEL_ENV !== "preview"/);
  assert.match(api, /MYRYRA_STAGING_TEST_CONSOLE_ENABLED/);
  assert.match(api, /MYRYRA_STAGING_TEST_ADMIN_IDS/);
  assert.match(api, /NEXT_PUBLIC_SUPABASE_URL !== "https:\/\/xanavauqzsrgvdfhcrsm\.supabase\.co"/);
  assert.match(api, /app_metadata\?\.role === "admin"/);
  assert.match(api, /db\.auth\.getUser\(\)/);
});
test("bootstrap dispatch has fixed branch, workflow, and safe inputs", () => {
  assert.match(api, /const branch = "feat\/mvp2-professora-journey-myra-26"/);
  assert.match(api, /const workflow = "journey-auth-staging\.yml"/);
  assert.match(api, /body\.action !== "bootstrap"/);
  assert.match(api, /bootstrap_synthetic_accounts: "true"/);
  assert.match(api, /run_mika_concurrency: "false"/);
  assert.match(api, /origin !== new URL\(request\.url\)\.origin/);
  assert.doesNotMatch(api, /process\.env\.GITHUB_TOKEN\b/);
});
test("staging console does not request secrets in the browser", () => {
  assert.match(page, /\/api\/internal\/staging-bootstrap/);
  assert.doesNotMatch(page, /NEXT_PUBLIC_.*TOKEN/);
  assert.doesNotMatch(page, /type="password"/);
  assert.match(dashboard, /MYRYRA_STAGING_TEST_ADMIN_IDS/);
  assert.match(dashboard, /NEXT_PUBLIC_SUPABASE_URL === "https:\/\/xanavauqzsrgvdfhcrsm\.supabase\.co"/);
});
