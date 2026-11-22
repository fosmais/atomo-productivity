const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/app/api/cron/support-email-outbox/route.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function setup(env) {
  const exports = {};
  let adminCalls = 0;
  const response = { json: (body, opts = {}) => ({ body, status: opts.status ?? 200, headers: opts.headers }) };
  const requireMock = (name) => {
    if (name === "next/server") return { NextResponse: response };
    if (name === "@/lib/supabase/admin") return { createSupabaseAdmin: () => { adminCalls++; throw new Error("database must not be touched"); } };
    if (name === "@/lib/support/email") return { sendSupportEmail: () => { throw new Error("mail must not be sent"); } };
    throw new Error("Unexpected import " + name);
  };
  vm.runInNewContext(js, { exports, require: requireMock, process: { env }, Date, String, Number });
  const request = (token) => ({ headers: { get: (key) => key === "authorization" ? token : null } });
  return { get: exports.GET, request, getAdminCalls: () => adminCalls };
}

test("cron rejects missing secret even with matching empty authorization", async () => {
  const h = setup({ MIKA_EMAIL_ENABLED: "true", RESEND_API_KEY: "dummy" });
  const result = await h.get(h.request("Bearer undefined"));
  assert.equal(result.status, 401);
  assert.equal(h.getAdminCalls(), 0);
});

test("cron rejects incorrect authorization without database access", async () => {
  const h = setup({ CRON_SECRET: "expected", MIKA_EMAIL_ENABLED: "true", RESEND_API_KEY: "dummy" });
  const result = await h.get(h.request("Bearer incorrect"));
  assert.equal(result.status, 401);
  assert.equal(h.getAdminCalls(), 0);
});

test("cron stays disabled without explicit email enablement", async () => {
  const h = setup({ CRON_SECRET: "expected", RESEND_API_KEY: "dummy" });
  const result = await h.get(h.request("Bearer expected"));
  assert.equal(result.body.disabled, true);
  assert.equal(h.getAdminCalls(), 0);
});

test("cron stays disabled without provider credentials", async () => {
  const h = setup({ CRON_SECRET: "expected", MIKA_EMAIL_ENABLED: "true" });
  const result = await h.get(h.request("Bearer expected"));
  assert.equal(result.body.disabled, true);
  assert.equal(h.getAdminCalls(), 0);
});

test("non-production cron does not query DB without test recipients", async () => {
  for (const envName of ["preview", "development", undefined]) {
    const h = setup({ CRON_SECRET: "expected", MIKA_EMAIL_ENABLED: "true", RESEND_API_KEY: "dummy", VERCEL_ENV: envName });
    const result = await h.get(h.request("Bearer expected"));
    assert.equal(result.body.disabled, true);
    assert.equal(result.body.reason, "Test recipients not configured");
    assert.equal(h.getAdminCalls(), 0);
  }
});
