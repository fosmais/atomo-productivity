const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Structural release guard for both legacy Asaas webhook entry points.
// These tests do not replace sandbox integration tests.
const root = path.join(__dirname, "..");
const canonical = fs.readFileSync(path.join(root, "src/app/api/billing/asaas/webhook/route.ts"), "utf8");
const alternate = fs.readFileSync(path.join(root, "src/app/api/billing/webhooks/asaas/route.ts"), "utf8");
const worker = fs.readFileSync(path.join(root, "src/app/api/billing/reconciliation/queue/route.ts"), "utf8");

for (const [name, source] of [["canonical", canonical], ["alternate", alternate]]) {
  test(name + " Asaas webhook checks the shared secret with timing-safe comparison", () => {
    assert.match(source, /timingSafeEqual\(/);
    assert.match(source, /asaas-access-token/);
  });
  test(name + " Asaas webhook persists receipt before acknowledging it", () => {
    assert.match(source, /ignoreDuplicates:\s*true/);
    assert.match(source, /status:\s*503/);
    assert.match(source, /enqueue_asaas_reconciliation_event/);
  });
  test(name + " Asaas webhook returns retryable failure on queue error", () => {
    assert.match(source, /if\s*\(enqueueError\)\s*throw enqueueError|if\s*\(queueError\s*\|\|/);
    assert.match(source, /Fila indisponível[^\n]*status:\s*503/);
  });
  test(name + " Asaas webhook rejects invalid payment reference", () => {
    assert.match(source, /status:\s*422/);
  });
}
test("queue worker cannot activate paid entitlements before approval", () => {
  assert.match(worker, /entitlementsActivated:\s*false/);
  assert.doesNotMatch(worker, /BILLING_ENTITLEMENTS_ENABLED\s*=\s*true/);
});
