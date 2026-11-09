// Authorization policy unit tests; no external calls or writes.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");
const source = fs.readFileSync(path.join(__dirname, "../src/lib/mika/action-policy.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = new Module("mika-action-policy", module);
mod.filename = "mika-action-policy.js";
mod.paths = module.paths;
mod._compile(js, mod.filename);
const { authorizeMikaAction } = mod.exports;
const now = Date.parse("2026-11-08T20:00:00Z");
const digest = "a".repeat(64);
const request = { kind: "reserve_focus", userId: "user-a", actionId: "action-1", payloadDigest: digest };
const approval = { userId: "user-a", actionId: "action-1", payloadDigest: digest, approved: true, expiresAt: "2026-11-08T20:05:00Z" };

test("read-only action allowed without approval", () => {
  assert.deepEqual(authorizeMikaAction({ ...request, kind: "read_daily_plan" }, now), { allowed: true, reason: "read_only" });
});
test("writes denied by default", () => {
  assert.equal(authorizeMikaAction(request, now).reason, "approval_required");
});
test("approved action matches user, action and payload", () => {
  assert.deepEqual(authorizeMikaAction({ ...request, approval }, now), { allowed: true, reason: "approved" });
});
test("approval cannot be replayed for another user, action or payload", () => {
  for (const patch of [{ userId: "user-b" }, { actionId: "action-2" }, { payloadDigest: "b".repeat(64) }]) {
    assert.equal(authorizeMikaAction({ ...request, ...patch, approval }, now).reason, "approval_mismatch");
  }
});
test("expired or implausibly long approvals are denied", () => {
  assert.equal(authorizeMikaAction({ ...request, approval: { ...approval, expiresAt: "2026-11-08T19:59:00Z" } }, now).reason, "approval_expired");
  assert.equal(authorizeMikaAction({ ...request, approval: { ...approval, expiresAt: "2026-11-08T21:00:00Z" } }, now).reason, "approval_expired");
});
test("external bookings and payments remain blocked even with approval", () => {
  for (const kind of ["external_booking", "payment"]) {
    assert.equal(authorizeMikaAction({ ...request, kind, approval }, now).reason, "blocked_external_action");
  }
});
