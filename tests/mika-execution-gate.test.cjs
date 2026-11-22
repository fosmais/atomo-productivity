const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");
const root = path.join(__dirname, "../src/lib/mika");
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name).exports;
  const filename = path.join(root, name + ".ts");
  const source = fs.readFileSync(filename, "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = new Module(filename, module);
  cache.set(name, mod);
  mod.filename = filename;
  mod.paths = module.paths;
  mod.require = (id) => id.startsWith("./") ? load(id.slice(2)) : require(id);
  mod._compile(js, filename);
  return mod.exports;
}
const { checkStoredMikaExecution } = load("execution-gate");
const { mikaActionDigest } = load("action-digest");
const now = Date.parse("2026-11-08T20:00:00Z");
const proposal = {
  userId: "user-a", actionId: "action-1", kind: "create_task",
  payload: { title: "Estudar" }, status: "approved", approvedBy: "user-a",
  approvedAt: "2026-11-08T19:59:00Z", expiresAt: "2026-11-08T20:05:00Z"
};
proposal.payloadDigest = mikaActionDigest(proposal);
test("server-owned approved proposal passes preflight", () => {
  assert.deepEqual(checkStoredMikaExecution(proposal, "user-a", now), { allowed: true, actionId: "action-1" });
});
test("different authenticated user cannot execute proposal", () => {
  assert.equal(checkStoredMikaExecution(proposal, "user-b", now).reason, "approval_invalid");
});
test("mutated payload and already executing status are rejected", () => {
  assert.equal(checkStoredMikaExecution({ ...proposal, payload: { title: "Alterado" } }, "user-a", now).reason, "payload_mismatch");
  assert.equal(checkStoredMikaExecution({ ...proposal, status: "executing" }, "user-a", now).reason, "not_approved");
});
test("expired approval and external payment are rejected", () => {
  assert.equal(checkStoredMikaExecution({ ...proposal, expiresAt: "2026-11-08T19:58:00Z" }, "user-a", now).reason, "approval_expired");
  const payment = { ...proposal, kind: "payment" };
  payment.payloadDigest = mikaActionDigest(payment);
  assert.equal(checkStoredMikaExecution(payment, "user-a", now).reason, "blocked_action");
});
