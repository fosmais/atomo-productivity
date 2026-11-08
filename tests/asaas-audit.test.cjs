"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyAsaasOperation } = require("../src/lib/billing/asaas-audit-classification.cjs");
const now = Date.parse("2026-11-08T20:00:00Z");
const base = { state: "completed", provider_id: "cus_test", updated_at: "2026-11-08T19:59:00Z" };
test("completed linked operation is healthy", () => {
  assert.equal(classifyAsaasOperation(base, now).requiresReview, false);
});
test("completed operation without remote ID requires review", () => {
  const result = classifyAsaasOperation({ ...base, provider_id: null }, now);
  assert.equal(result.completedWithoutProviderId, true);
  assert.equal(result.requiresReview, true);
});
test("remote-created operation without ID requires review", () => {
  const result = classifyAsaasOperation({ ...base, state: "remote_created", provider_id: null }, now);
  assert.equal(result.remoteCreatedWithoutProviderId, true);
  assert.equal(result.requiresReview, true);
});
test("needs_recovery is flagged even when recent", () => {
  assert.equal(classifyAsaasOperation({ ...base, state: "needs_recovery" }, now).requiresReview, true);
});
test("reserved operation older than 15 minutes is stalled", () => {
  const result = classifyAsaasOperation({ ...base, state: "reserved", updated_at: "2026-11-08T19:40:00Z" }, now);
  assert.equal(result.stalled, true);
});
test("recent reserved operation is not yet stalled", () => {
  assert.equal(classifyAsaasOperation({ ...base, state: "reserved" }, now).requiresReview, false);
});
test("invalid timestamps fail closed", () => {
  assert.equal(classifyAsaasOperation({ ...base, state: "reserved", updated_at: "invalid" }, now).requiresReview, true);
});
test("unknown states are flagged", () => {
  assert.equal(classifyAsaasOperation({ ...base, state: "unknown" }, now).unknownState, true);
});
