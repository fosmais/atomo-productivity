const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/task-confirmation.tsx"), "utf8");

function handler(name, next) {
  const start = source.indexOf("async function " + name + "()");
  const end = source.indexOf(next, start);
  assert.ok(start >= 0 && end > start, name + " must exist");
  return source.slice(start, end);
}

test("confirm and cancel both acquire the same synchronous in-flight lock", () => {
  for (const name of ["handleConfirm", "handleCancel"]) {
    const body = handler(name, name === "handleConfirm" ? "async function handleCancel()" : "return (");
    assert.match(body, /if \(inFlight\.current \|\| decision\) return;/);
    assert.match(body, /inFlight\.current = true;/);
    assert.match(body, /finally\s*\{\s*inFlight\.current = false;/);
    assert.ok(body.indexOf("inFlight.current = true;") < body.indexOf("await "), "lock must precede async work");
  }
});

test("buttons remain disabled during an in-flight operation", () => {
  const buttons = source.match(/disabled=\{working\}/g) || [];
  assert.equal(buttons.length, 2);
});

test("successful confirmation refreshes task views", () => {
  assert.match(handler("handleConfirm", "async function handleCancel()"), /myryra:tasks-updated/);
});
