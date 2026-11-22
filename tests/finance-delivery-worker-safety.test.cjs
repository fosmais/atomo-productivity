const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const route = fs.readFileSync(path.join(__dirname, '../src/app/api/internal/finance-notifications/route.ts'), 'utf8');
const claim = fs.readFileSync(path.join(__dirname, '../docs/mvp2/finance-delivery-atomic-claim-homolog.sql'), 'utf8');
const recovery = fs.readFileSync(path.join(__dirname, '../docs/mvp2/finance-delivery-stale-recovery-homolog.sql'), 'utf8');

test('finance worker excludes deferred notifications before batch limit', () => {
  const dueFilter = route.indexOf('.or(`next_attempt_at.is.null,next_attempt_at.lte.');
  const limit = route.indexOf('.limit(MAX_BATCH)');
  assert.ok(dueFilter >= 0 && limit > dueFilter);
});
test('finance worker remains explicitly dry-run and secret protected', () => {
  assert.match(route, /MYRYRA_NOTIFICATION_WORKER_SECRET/);
  assert.match(route, /mode: "dry-run"/);
  assert.match(route, /deliveryEnabled: false/);
  assert.doesNotMatch(route, /\.rpc\("claim_finance_delivery_batch"/);
});
test('finance claim uses atomic row locking and service-only access', () => {
  assert.match(claim, /FOR UPDATE SKIP LOCKED/);
  assert.match(claim, /auth\.role\(\).*service_role/);
  assert.match(claim, /REVOKE ALL.*PUBLIC,anon,authenticated/);
});
test('stale recovery is bounded and does not resend externally', () => {
  assert.match(recovery, /p_stale_minutes < 5/);
  assert.match(recovery, /FOR UPDATE SKIP LOCKED/);
  assert.match(recovery, /status='cancelled'/);
  assert.match(recovery, /next_attempt_at=NULL/);
  assert.match(recovery, /pending delivery outcome reconciliation/);
});

test('atomic finance claim requires matching notification ownership', () => {
  assert.match(claim, /n\.id=d\.notification_id AND n\.user_id=d\.user_id/);
  assert.match(claim, /p\.user_id=d\.user_id/);
});
test('atomic finance claim enforces explicit consent for each channel', () => {
  assert.match(claim, /d\.channel='email' AND p\.email_enabled IS TRUE/);
  assert.match(claim, /d\.channel='push' AND p\.push_enabled IS TRUE/);
  assert.match(claim, /d\.attempts < 3/);
  assert.match(claim, /d\.next_attempt_at IS NULL OR d\.next_attempt_at <= now\(\)/);
});
