const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/support/email.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function harness(env, response = { ok: true }) {
  const calls = [];
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    process: { env },
    fetch: async (...args) => { calls.push(args); return response; },
    AbortSignal: { timeout: () => ({}) },
  });
  return { send: exports.sendSupportEmail, calls };
}
const notice = { to: "qa@example.invalid", subject: "Chamado teste", ticketId: "abcdef12-0000-0000-0000-000000000000", message: "Teste", idempotencyKey: "support-outbox/test" };

test("Preview denies all recipients by default without contacting Resend", async () => {
  const h = harness({ VERCEL_ENV: "preview", RESEND_API_KEY: "dummy" });
  const result = await h.send(notice);
  assert.equal(result.sent, false);
  assert.equal(h.calls.length, 0);
});

test("Preview denies unlisted recipients even when API key exists", async () => {
  const h = harness({ VERCEL_ENV: "preview", RESEND_API_KEY: "dummy", MIKA_SUPPORT_TEST_RECIPIENTS: "other@example.invalid" });
  assert.equal((await h.send(notice)).sent, false);
  assert.equal(h.calls.length, 0);
});

test("Preview sends only to allowlisted test recipient with stable idempotency key", async () => {
  const h = harness({ VERCEL_ENV: "preview", RESEND_API_KEY: "dummy", MIKA_SUPPORT_TEST_RECIPIENTS: " OTHER@example.invalid , QA@EXAMPLE.INVALID " });
  assert.equal((await h.send(notice)).sent, true);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][1].headers["Idempotency-Key"], "support-outbox/test");
  assert.deepEqual(JSON.parse(h.calls[0][1].body).to, ["qa@example.invalid"]);
});

test("Preview does not send when provider key is absent", async () => {
  const h = harness({ VERCEL_ENV: "preview", MIKA_SUPPORT_TEST_RECIPIENTS: "qa@example.invalid" });
  assert.equal((await h.send(notice)).sent, false);
  assert.equal(h.calls.length, 0);
});

test("Provider failures return safe error without leaking secrets", async () => {
  const h = harness({ VERCEL_ENV: "preview", RESEND_API_KEY: "dummy", MIKA_SUPPORT_TEST_RECIPIENTS: "qa@example.invalid" }, { ok: false, status: 503 });
  const result = await h.send(notice);
  assert.equal(result.sent, false);
  assert.match(result.reason, /HTTP 503/);
});
