const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateExternalAction } = require("../src/lib/mika/external-action-gate.cjs");

test("rejects missing app or action", () => {
  assert.equal(evaluateExternalAction({ action: "booking" }).status, "invalid");
});
test("a link-only provider cannot execute or claim success", () => {
  const result = evaluateExternalAction({ connector: "uber", action: "booking", providerSupportsAction: false, userConfirmed: true, verifiedExecution: true });
  assert.equal(result.status, "handoff_only");
  assert.equal(result.completed, false);
});
test("requires specific granted scopes", () => {
  assert.equal(evaluateExternalAction({ connector: "calendar", action: "create_event", providerSupportsAction: true, scopes: ["calendar.write"], grantedScopes: ["calendar.read"] }).status, "authorization_required");
});
test("requires confirmation for sensitive operations", () => {
  assert.equal(evaluateExternalAction({ connector: "messages", action: "send_message", providerSupportsAction: true, scopes: ["messages.send"], grantedScopes: ["messages.send"] }).status, "confirmation_required");
});
test("ready is not completed until provider verifies", () => {
  const input = { connector: "calendar", action: "create_event", providerSupportsAction: true, scopes: ["calendar.write"], grantedScopes: ["calendar.write"] };
  assert.deepEqual([evaluateExternalAction(input).status, evaluateExternalAction(input).completed], ["ready_to_execute", false]);
  assert.deepEqual([evaluateExternalAction({ ...input, verifiedExecution: true }).status, evaluateExternalAction({ ...input, verifiedExecution: true }).completed], ["completed", true]);
});
