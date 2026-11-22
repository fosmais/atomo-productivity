const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/app/api/support/submit/route.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
function harness({ authorizeMika = true, category = "general", legal = true, answer = "Confira a conexão do Google Calendar nas configurações.", aiEnabled = true } = {}) {
  const calls = { ai: 0, legal: 0, replies: 0, tickets: 0 };
  const user = { id: "user-1", email: "qa@example.invalid", email_confirmed_at: "2026-11-22" };
  const admin = {
    rpc: () => { calls.tickets++; return { single: async () => ({ data: { id: "12345678-1234-1234-1234-123456789abc", subject: "Agenda", status: "open", priority: "normal", created_at: "2026-11-22" }, error: null }) }; },
    from: (table) => ({ insert: async () => { if (table === "support_ticket_replies") calls.replies++; return { error: null }; } })
  };
  class MockOpenAI {
    constructor() {}
    responses = { create: async () => { calls.ai++; return { output_text: answer }; } };
  }
  const mockRequire = (name) => {
    if (name === "next/server") return { NextResponse: { json: (body, opts = {}) => ({ body, status: opts.status ?? 200 }) } };
    if (name === "openai") return { __esModule: true, default: MockOpenAI };
    if (name === "@/lib/supabase/server") return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) };
    if (name === "@/lib/supabase/admin") return { createSupabaseAdmin: () => admin };
    if (name === "@/lib/privacy/legal-acceptance") return { hasCurrentLegalAcceptance: async () => { calls.legal++; return legal; } };
    throw Error("Unexpected import " + name);
  };
  const exports = {};
  vm.runInNewContext(js, { exports, require: mockRequire, process: { env: { MIKA_SUPPORT_AI_ENABLED: aiEnabled ? "true" : "false", OPENAI_API_KEY: "dummy" } }, TextDecoder, URL });
  const payload = JSON.stringify({ subject: "Agenda", message: "Como sincronizar meus eventos?", category, authorizeMika });
  const bytes = new TextEncoder().encode(payload);
  const request = { headers: { get: () => String(bytes.length) }, body: { getReader: () => ({ read: async () => ({ done: false, value: bytes }), releaseLock: () => {}, cancel: async () => {} }) } };
  let read = false;
  request.body.getReader = () => ({ read: async () => { if (read) return { done: true }; read = true; return { done: false, value: bytes }; }, releaseLock: () => {}, cancel: async () => {} });
  return { run: () => exports.POST(request), calls };
}

test("MIKA never invokes AI without explicit customer consent", async () => {
  const h = harness({ authorizeMika: false });
  const r = await h.run();
  assert.equal(r.status, 201);
  assert.equal(r.body.mika.answered, false);
  assert.equal(h.calls.ai, 0);
  assert.equal(h.calls.replies, 0);
});

test("Billing tickets never invoke AI even with consent", async () => {
  const h = harness({ category: "billing" });
  const r = await h.run();
  assert.equal(r.status, 201);
  assert.equal(h.calls.ai, 0);
  assert.equal(h.calls.replies, 0);
});

test("Missing legal acceptance escalates without invoking AI", async () => {
  const h = harness({ legal: false });
  const r = await h.run();
  assert.equal(r.status, 201);
  assert.equal(r.body.mika.escalated, true);
  assert.equal(h.calls.ai, 0);
  assert.equal(h.calls.replies, 0);
});

test("Consent and current legal acceptance permit AI support reply", async () => {
  const h = harness();
  const r = await h.run();
  assert.equal(r.status, 201);
  assert.equal(r.body.mika.answered, true);
  assert.equal(h.calls.ai, 1);
  assert.equal(h.calls.replies, 1);
});

test("Escalation marker prevents AI reply persistence", async () => {
  const h = harness({ answer: "[[ESCALATE]] Atendimento humano necessário." });
  const r = await h.run();
  assert.equal(r.status, 201);
  assert.equal(r.body.mika.escalated, true);
  assert.equal(h.calls.ai, 1);
  assert.equal(h.calls.replies, 0);
});

test("Disabled AI flag prevents any model invocation", async () => {
  const h = harness({ aiEnabled: false });
  const r = await h.run();
  assert.equal(r.status, 201);
  assert.equal(h.calls.ai, 0);
});
