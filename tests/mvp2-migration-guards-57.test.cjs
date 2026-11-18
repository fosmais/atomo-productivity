const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(process.cwd(), 'supabase/migrations', name), 'utf8');
const grant = read('20261118021000_journey_service_role_update_grant.sql');
const consistency = read('20261118033000_journey_learning_assessment_consistency.sql');

test('Journey UPDATE is granted only to server role', () => {
  assert.match(grant, /grant\s+update\s+on\s+table\s+public\.myryra_journeys\s+to\s+service_role\s*;/i);
  assert.doesNotMatch(grant, /\bto\s+(?:authenticated|anon|public)\b/i);
});

test('Assessment consistency migration checks existence before creation', () => {
  assert.match(consistency, /if\s+not\s+exists\s*\(/i);
  assert.match(consistency, /conrelid\s*=\s*'public\.myryra_journey_learning_progress'::regclass/i);
  assert.match(consistency, /conname\s*=\s*'journey_learning_assessment_consistency'/i);
  assert.match(consistency, /add\s+constraint\s+journey_learning_assessment_consistency/i);
});

test('Assessment score and pass status must both be null or both populated', () => {
  assert.match(consistency, /assessment_score\s+is\s+null\s+and\s+assessment_passed\s+is\s+null/i);
  assert.match(consistency, /assessment_score\s+is\s+not\s+null\s+and\s+assessment_passed\s+is\s+not\s+null/i);
  assert.doesNotMatch(consistency, /\bdrop\s+(?:table|constraint)\b|\btruncate\b|\bdelete\s+from\b/i);
});
