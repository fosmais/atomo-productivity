const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/app/api/support/replies/route.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const id = "9f172b82-6f03-44ca-9c2e-8e203e441b27";

function harness({ user = null, owned = false, ownershipError = null, replyError = null } = {}) {
  let adminCalls = 0;
  let ownerCalls = 0;
  const reply = { id: "reply-1", body: "Recebemos sua solicitação", author_type: "human", created_at: "2026-11-22" };
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: async () => ({ data: [reply], error: replyError })
  };
  const mockRequire = (name) => {
    if (name === "next/server") return { NextResponse: { json: (body, opts = {}) => ({ body, status: opts.status ?? 200 }) } };
    if (name === "@/lib/supabase/server") return { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user }, error: null }) },
      from: () => {
        ownerCalls++;
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: owned ? { id } : null, error: ownershipError }) }) }) }) };
      }
    }) };
    if (name === "@/lib/supabase/admin") return { createSupabaseAdmin: () => { adminCalls++; return { from: () => query }; } };
    throw Error("Unexpected import " + name);
  };
  const exports = {};
  vm.runInNewContext(js, { exports, require: mockRequire, URL });
  return { get: exports.GET, request: (ticket) => ({ url: "https://example.invalid/api/support/replies?ticket=" + ticket }), stats: () => ({ adminCalls, ownerCalls }) };
}

test("replies endpoint rejects unauthenticated requests without admin access", async () => {
  const h = harness();
  const result = await h.get(h.request(id));
  assert.equal(result.status, 401);
  assert.equal(h.stats().adminCalls, 0);
});

test("replies endpoint rejects malformed IDs without querying ownership", async () => {
  const h = harness({ user: { id: "user-1" } });
  const result = await h.get(h.request("not-a-uuid"));
  assert.equal(result.status, 400);
  assert.equal(h.stats().ownerCalls, 0);
  assert.equal(h.stats().adminCalls, 0);
});

test("replies endpoint denies other users' tickets before admin read", async () => {
  const h = harness({ user: { id: "user-2" }, owned: false });
  const result = await h.get(h.request(id));
  assert.equal(result.status, 404);
  assert.equal(h.stats().adminCalls, 0);
});

test("replies endpoint returns only owned ticket replies", async () => {
  const h = harness({ user: { id: "user-1" }, owned: true });
  const result = await h.get(h.request(id));
  assert.equal(result.status, 200);
  assert.equal(result.body.replies.length, 1);
  assert.equal(h.stats().adminCalls, 1);
});

test("replies endpoint fails closed on ownership query errors", async () => {
  const h = harness({ user: { id: "user-1" }, ownershipError: { message: "database unavailable" } });
  const result = await h.get(h.request(id));
  assert.equal(result.status, 404);
  assert.equal(h.stats().adminCalls, 0);
});
