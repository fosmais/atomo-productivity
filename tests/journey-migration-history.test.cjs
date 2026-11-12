const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");
const recovered = [
  "20261109212001_create_atomic_journey_with_missions",
  "20261110004235_journey_confirmation_idempotency_key",
  "20261110011758_myryra_atomic_journey_confirmation",
  "20261110033112_create_owner_scoped_journey_draft_snapshots",
  "20261110033908_add_signed_journey_snapshot_integrity",
  "20261110034947_atomic_journey_snapshot_confirmation_link",
  "20261110121233_myryra_journey_myra_rewards_ledger",
  "20261110192741_journey_achievements_private_photos_20261110",
  "20261110200551_journey_learning_progress_private",
  "20261110225657_journey_learning_assessment_metadata",
  "20261110232856_journey_review_steps_persistence",
  "20261111005128_journey_achievement_snapshots",
];

test("historical Journey migrations recovered from Supabase remain versioned", () => {
  for (const migration of recovered) {
    const file = path.join(migrationsDir, migration + ".sql");
    assert.ok(fs.existsSync(file), `Missing applied migration: ${migration}`);
    assert.ok(fs.readFileSync(file, "utf8").trim().length > 30, `Empty migration: ${migration}`);
  }
});

test("recovered Journey migration versions remain unique", () => {
  const filenames = fs.readdirSync(migrationsDir).filter((file) => /^\d{14}_.+\.sql$/.test(file));
  const versions = filenames.map((file) => file.slice(0, 14));
  for (const migration of recovered) {
    const version = migration.slice(0, 14);
    assert.equal(versions.filter((v) => v === version).length, 1, `Duplicate version ${version}`);
  }
});

test("atomic lesson booking migration remains after historical Journey migrations", () => {
  const booking = "20261112000100_myryra_journey_lesson_atomic.sql";
  assert.ok(fs.existsSync(path.join(migrationsDir, booking)));
  assert.ok(recovered.every((name) => name.slice(0, 14) < booking.slice(0, 14)));
});
