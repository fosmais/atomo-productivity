const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");
const source = fs.readFileSync(path.join(__dirname, "../src/lib/mika/proposal-lifecycle.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = new Module("mika-proposal-lifecycle", module);
mod.filename = "mika-proposal-lifecycle.js";
mod.paths = module.paths;
mod._compile(js, mod.filename);
const { transitionMikaProposal } = mod.exports;
test("proposal requires approval before execution", () => {
  assert.deepEqual(transitionMikaProposal("proposed", "start"), { ok: false, reason: "invalid_transition" });
  assert.deepEqual(transitionMikaProposal("proposed", "approve"), { ok: true, status: "approved" });
  assert.deepEqual(transitionMikaProposal("approved", "start"), { ok: true, status: "executing" });
  assert.deepEqual(transitionMikaProposal("executing", "succeed"), { ok: true, status: "succeeded" });
});
test("terminal proposals cannot be replayed", () => {
  for (const status of ["succeeded", "failed", "rejected", "expired"]) {
    for (const event of ["approve", "start", "succeed"]) {
      assert.equal(transitionMikaProposal(status, event).ok, false);
    }
  }
});
test("rejected and expired proposals never execute", () => {
  assert.deepEqual(transitionMikaProposal("proposed", "reject"), { ok: true, status: "rejected" });
  assert.deepEqual(transitionMikaProposal("approved", "expire"), { ok: true, status: "expired" });
  assert.equal(transitionMikaProposal("expired", "start").ok, false);
});
