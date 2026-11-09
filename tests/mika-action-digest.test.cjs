const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");
const source = fs.readFileSync(path.join(__dirname, "../src/lib/mika/action-digest.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = new Module("mika-action-digest", module);
mod.filename = "mika-action-digest.js";
mod.paths = module.paths;
mod._compile(js, mod.filename);
const { mikaActionDigest } = mod.exports;
const base = { userId: "user-a", actionId: "action-1", kind: "create_task", payload: { title: "Reunião", details: { b: 2, a: 1 } } };
test("stable SHA256 digest regardless of object key order", () => {
  const a = mikaActionDigest(base);
  const b = mikaActionDigest({ ...base, payload: { details: { a: 1, b: 2 }, title: "Reunião" } });
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
});
test("action fingerprint changes for owner, action, kind and payload", () => {
  const original = mikaActionDigest(base);
  for (const changed of [
    { ...base, userId: "user-b" }, { ...base, actionId: "action-2" },
    { ...base, kind: "create_event" }, { ...base, payload: { title: "Outro" } }
  ]) assert.notEqual(mikaActionDigest(changed), original);
});
test("rejects invalid action identities and nonfinite numbers", () => {
  assert.throws(() => mikaActionDigest({ ...base, userId: "" }));
  assert.throws(() => mikaActionDigest({ ...base, payload: { minutes: Infinity } }));
});
