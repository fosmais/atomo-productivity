const test = require("node:test");
const assert = require("node:assert/strict");
const { isAction, validateProposalList } = require("../src/lib/mika/action-validation.cjs");

const valid = { type: "create_task", title: "Preparar reunião", reason: "Prioridade de amanhã", due_at: null };

test("accepts a valid task proposal", () => {
  assert.deepEqual(validateProposalList({ actions: [valid] }), [valid]);
});
test("rejects unsupported or unsafe action types", () => {
  for (const type of ["delete_task", "send_payment", "share_data", ""]) {
    assert.equal(isAction({ ...valid, type }), false);
  }
});
test("rejects malformed or oversized proposals", () => {
  assert.equal(validateProposalList({ actions: Array(6).fill(valid) }), null);
  assert.equal(validateProposalList({ actions: [{ ...valid, title: "" }] }), null);
  assert.equal(validateProposalList({ actions: [{ ...valid, title: "x".repeat(161) }] }), null);
  assert.equal(validateProposalList({ actions: "not-an-array" }), null);
});
test("requires explicit timezone for dates", () => {
  assert.equal(isAction({ ...valid, due_at: "2026-11-09T10:00:00" }), false);
  assert.equal(isAction({ ...valid, due_at: "2026-11-09T10:00:00-03:00" }), true);
  assert.equal(isAction({ ...valid, due_at: "2026-11-09T13:00:00Z" }), true);
});
test("does not accept non-string reasons or dates", () => {
  assert.equal(isAction({ ...valid, reason: null }), false);
  assert.equal(isAction({ ...valid, due_at: 123 }), false);
});
