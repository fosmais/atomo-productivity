const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/app/api/support/submit/route.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function harness({ user = null, rpcError = null } = {}) {
  let adminCalls = 0;
  let rpcCalls = 0;
  let queueCalls = 0;
  const response = { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) };
  const admin = {
    rpc: (_name, _params) => {
      rpcCalls++;
      return { single: async () => rpcError
        ? { data: null, error: { message: rpcError } }
        : { data: { id: "ticket-1", subject: "Ajuda", status: "open", priority: "normal", created_at: "2026-11-22" }, error: null } };
    },
    from: () => ({ insert: async () => { queueCalls++; return { error: null }; } })
  };
  const mockRequire = (name) => {
    if (name === "next/server") return { NextResponse: response };
    if (name === "openai") return { default: class {} };
    if (name === "@/lib/supabase/server") return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) };
    if (name === "@/lib/supabase/admin") return { createSupabaseAdmin: () => { adminCalls++; return admin; } };
    if (name === "@/lib/privacy/legal-acceptance") return { hasCurrentLegalAcceptance: async () => false };
    throw Error("Unexpected import " + name);
  };
  const exports = {};
  vm.runInNewContext(js, { exports, require: mockRequire, process: { env: {} }, TextDecoder, Number, String, Object, JSON, Set, Error, Array });
  const request = (data) => {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    return { headers: { get: () => null }, body: { getReader: () => {
      let read = false;
      return { read: async () => read ? { done: true } : (read = true, { done: false, value: bytes }), releaseLock: () => {}, cancel: async () => {} };
    } } };
  };
  return { post: exports.POST, request, stats: () => ({ adminCalls, rpcCalls, queueCalls }) };
}

const valid = { subject: "Ajuda", message: "Preciso de ajuda para acessar minha agenda.", category: "general", authorizeMika: false };

test("anonymous request is rejected before any admin access", async () => {
  const h = harness();
  const result = await h.post(h.request(valid));
  assert.equal(result.status, 401);
  assert.equal(h.stats().adminCalls, 0);
});

test("unknown input fields cannot reach privileged RPC", async () => {
  const h = harness({ user: { id: "user-1" } });
  const result = await h.post(h.request({ ...valid, isAdmin: true }));
  assert.equal(result.status, 400);
  assert.equal(h.stats().adminCalls, 0);
});

test("invalid consent type cannot reach privileged RPC", async () => {
  const h = harness({ user: { id: "user-1" } });
  const result = await h.post(h.request({ ...valid, authorizeMika: "true" }));
  assert.equal(result.status, 400);
  assert.equal(h.stats().adminCalls, 0);
});

test("database rate limiting maps to HTTP 429 without queueing mail", async () => {
  const h = harness({ user: { id: "user-1" }, rpcError: "SUPPORT_RATE_LIMIT_EXCEEDED" });
  const result = await h.post(h.request(valid));
  assert.equal(result.status, 429);
  assert.equal(h.stats().rpcCalls, 1);
  assert.equal(h.stats().queueCalls, 0);
});

test("valid ticket returns 201 and queues notification with AI disabled", async () => {
  const h = harness({ user: { id: "user-1", email: "test@example.invalid", email_confirmed_at: "2026-11-22" } });
  const result = await h.post(h.request(valid));
  assert.equal(result.status, 201);
  assert.equal(result.body.emailQueued, true);
  assert.equal(result.body.mika.answered, false);
  assert.equal(h.stats().rpcCalls, 1);
  assert.equal(h.stats().queueCalls, 1);
});
