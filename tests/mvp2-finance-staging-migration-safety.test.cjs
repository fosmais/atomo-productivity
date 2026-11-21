const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const staging = path.join(root, 'docs/sql/staging-migrations');
const production = path.join(root, 'supabase/migrations');
const expected = [
  '20261108015537_finance_isolated_rls_harness.sql',
  '20261108023702_mvp2_finance_edit_trash_staging.sql',
  '20261108024538_mvp2_finance_balances_goals_planned_staging.sql',
  '20261108024810_mvp2_finance_remaining_four_tables_staging.sql',
  '20261108025045_mvp2_finance_constraints_parity_staging.sql',
  '20261108025147_mvp2_finance_rls_index_parity_staging.sql',
  '20261108025300_mvp2_finance_active_owner_index_staging.sql',
];

test('staging-only Finance migrations cannot be auto-picked from production migration folder', () => {
  for (const name of expected) {
    assert.ok(fs.existsSync(path.join(staging, name)), `missing staging file: ${name}`);
    assert.ok(!fs.existsSync(path.join(production, name)), `unsafe production migration: ${name}`);
  }
});

test('staging Finance replay contains all nine Finance table declarations', () => {
  const sql = expected.map((name) => fs.readFileSync(path.join(staging, name), 'utf8')).join('\n');
  const tables = [
    'entries', 'subscriptions', 'balances', 'goals', 'planned_expenses',
    'expected_income', 'alert_preferences', 'notifications', 'delivery_log',
  ];
  for (const name of tables) {
    assert.match(sql, new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? public\\.myryra_finance_${name}\\s*\\(`, 'i'));
  }
  assert.match(sql, /CREATE POLICY finance_entries_update_own/i);
  assert.match(sql, /CREATE POLICY finance_subscriptions_update_own/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS finance_entries_active_owner_idx/i);
});

test('Finance staging migrations have ordered, distinct timestamps', () => {
  const versions = expected.map((name) => name.slice(0, 14));
  assert.equal(new Set(versions).size, versions.length);
  assert.deepEqual(versions, [...versions].sort());
});
