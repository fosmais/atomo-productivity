const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function source(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}
const readiness = source("src/app/api/privacy/readiness/route.ts");
const acceptance = source("src/app/api/privacy/accept/route.ts");
const page = source("src/app/privacy/accept/page.tsx");
const dashboard = source("src/app/dashboard/page.tsx");

test("legal readiness requires authentication and current published versions of both documents", () => {
  assert.match(readiness, /auth\.getUser\(\)/);
  assert.match(readiness, /"terms", "privacy_notice"/);
  assert.match(readiness, /\.eq\("status", "published"\)/);
  assert.match(readiness, /\.lte\("published_at", now\)/);
  assert.match(readiness, /\.lte\("effective_at", now\)/);
  assert.match(readiness, /documents\.every\(\(document\) => document\.published && document\.accepted\)/);
  assert.match(readiness, /agentExecutionEnabled: false/);
});

test("legal acceptance requires explicit affirmative user action and does not trust a user id from request", () => {
  assert.match(acceptance, /auth\.getUser\(\)/);
  assert.match(acceptance, /getAuthenticatorAssuranceLevel\(\)/);
  assert.match(acceptance, /data\.accepted !== true/);
  assert.match(acceptance, /requestId/);
  assert.match(acceptance, /user_id: auth\.user\.id/);
  assert.match(acceptance, /\.eq\("status", "published"\)/);
  assert.match(acceptance, /\.lte\("published_at", now\)/);
  assert.match(acceptance, /\.lte\("effective_at", now\)/);
});

test("acceptance UI is opt-in and separates each document", () => {
  assert.match(page, /type="checkbox"/);
  assert.match(page, /checked=\{Boolean\(selected\[document\.type\]\)\}/);
  assert.match(page, /documentVersionId: document\.documentVersionId/);
  assert.match(page, /accepted: true/);
  assert.match(page, /Permissões opcionais da MIKA serão solicitadas separadamente/);
});

test("dashboard legal gate stays off by default and sends unaccepted users to the consent page", () => {
  assert.match(dashboard, /process\.env\.MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true"/);
  assert.match(dashboard, /redirect\("\/privacy\/accept"\)/);
  assert.match(dashboard, /\.eq\("user_id", user\.id\)/);
});
