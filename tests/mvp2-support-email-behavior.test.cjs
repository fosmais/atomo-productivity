const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/support/email.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

async function invoke({ key, fetchImpl, timeoutImpl = () => ({}) }) {
  const exports = {};
  const context = {
    exports,
    process: { env: { ...(key ? { RESEND_API_KEY: key } : {}), VERCEL_ENV: "preview", MIKA_SUPPORT_TEST_RECIPIENTS: "recipient@example.invalid" } },
    fetch: fetchImpl,
    AbortSignal: { timeout: timeoutImpl }
  };
  vm.runInNewContext(compiled, context);
  return exports.sendSupportEmail({
    to: "recipient@example.invalid",
    subject: "Teste",
    ticketId: "abcdef12-1234",
    message: "Mensagem de teste"
  });
}

test("support email fails safely when the Resend key is missing", async () => {
  const result = await invoke({ fetchImpl: () => { throw Error("Should not call fetch"); } });
  assert.equal(result.sent, false);
  assert.match(result.reason, /RESEND_API_KEY/);
});

test("support email succeeds with a valid Resend response and a 10s timeout", async () => {
  let request;
  let timeout;
  const result = await invoke({
    key: "synthetic-test-key",
    timeoutImpl: ms => { timeout = ms; return { synthetic: true }; },
    fetchImpl: async (url, options) => { request = { url, options }; return { ok: true, status: 200 }; }
  });
  assert.equal(result.sent, true);
  assert.equal(timeout, 10000);
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer synthetic-test-key");
  const body = JSON.parse(request.options.body);
  assert.equal(body.from, "MYRYRA Support <support@myryra.com>");
  assert.equal(body.to[0], "recipient@example.invalid");
});

test("support email handles provider rejection without leaking the key", async () => {
  const result = await invoke({
    key: "synthetic-test-key",
    fetchImpl: async () => ({ ok: false, status: 429 })
  });
  assert.equal(result.sent, false);
  assert.match(result.reason, /429/);
  assert.doesNotMatch(result.reason, /synthetic-test-key/);
});

test("support email handles network failure and timeout without throwing", async () => {
  for (const fetchImpl of [
    async () => { throw Error("connection refused"); },
    async () => { throw Error("timeout"); }
  ]) {
    const result = await invoke({ key: "synthetic-test-key", fetchImpl });
    assert.equal(result.sent, false);
    assert.match(result.reason, /Falha de comunicação/);
    assert.doesNotMatch(result.reason, /synthetic-test-key/);
  }
});
