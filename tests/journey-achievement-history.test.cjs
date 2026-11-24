const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const api = fs.readFileSync(path.join(__dirname, "../src/app/api/journeys/[journeyId]/achievements/route.ts"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "../src/app/journey/journey-achievement-card.tsx"), "utf8");
const migration = fs.readFileSync(path.join(__dirname, "../database/migrations/20261111_journey_achievement_snapshots.sql"), "utf8");

test("achievement snapshot stores completed mission count and existing MYRA ledger total", () => {
  assert.match(api, /missions\.some\(m => m\.status !== "completed"\)/);
  assert.match(api, /\.eq\("owner_id", user\.id\)\.eq\("journey_id", journeyId\)/);
  assert.match(api, /myraEarned \+= entries\.reduce\(\(sum, entry\) => sum \+ entry\.amount, 0\)/);
  assert.match(api, /completed_missions_at_achievement: missions\.length, myra_earned_at_achievement: myraEarned/);
  assert.doesNotMatch(api, /myryra_journey_myra_ledger"\)\s*\.(?:insert|update|upsert|delete)/);
});

test("historical gallery uses snapshot values and achievement date", () => {
  assert.match(api, /photo_path,achieved_at,completed_missions_at_achievement,myra_earned_at_achievement/);
  assert.match(ui, /new Date\(item\.achieved_at\)\.toLocaleDateString\("pt-BR"\)/);
  assert.match(ui, /savedAchievementText\(item\)/);
  assert.match(ui, /missions !== null/);
  assert.match(ui, /myras !== null/);
});

test("migration permits legacy achievements without snapshots and rejects negatives", () => {
  assert.match(migration, /add column if not exists completed_missions_at_achievement integer/);
  assert.match(migration, /add column if not exists myra_earned_at_achievement integer/);
  assert.match(migration, /completed_missions_at_achievement is null or completed_missions_at_achievement >= 0/);
  assert.match(migration, /myra_earned_at_achievement is null or myra_earned_at_achievement >= 0/);
});
