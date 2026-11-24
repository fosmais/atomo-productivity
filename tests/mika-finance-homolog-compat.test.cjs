const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '../docs/sql/mika-agent-finance-homolog-execution-compat.sql'), 'utf8');

test('finance homologation executor keeps owner lock and auth guard', () => {
  assert.match(sql, /v_user uuid := auth\.uid\(\)/);
  assert.match(sql, /where id=p_proposal_id and user_id=v_user for update/);
  assert.match(sql, /if v_user is null then raise exception 'unauthenticated'/);
});
test('finance homologation executor binds approved plan and expiry', () => {
  assert.match(sql, /if p\.expires_at <= now\(\) then/);
  assert.match(sql, /p\.payload->>'plan_id'/);
  assert.match(sql, /p_plan_id is distinct from v_payload_plan/);
  assert.match(sql, /where id=v_payload_plan and user_id=v_user/);
});
test('finance homologation executor supports idempotent replay and audit', () => {
  assert.match(sql, /p\.status='executed'/);
  assert.match(sql, /'already_executed'/);
  assert.match(sql, /insert into public\.mika_action_audit/);
  assert.match(sql, /'succeeded'/);
});
