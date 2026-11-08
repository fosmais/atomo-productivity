const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrations = [
  "20261108234929_autopilot_ignore_soft_deleted_events.sql",
  "20261108235900_autopilot_reject_soft_deleted_tasks.sql",
];
const read = (name) => fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", name), "utf8");

test("AutoPilot migrations retain ownership and authenticated identity checks", () => {
  const sql = read(migrations[1]);
  assert.match(sql, /v_user\s+uuid\s*:=\s*\(select auth\.uid\(\)\)/i);
  assert.match(sql, /if v_user is null then raise exception/i);
  assert.match(sql, /where id\s*=\s*p_task_id\s+and user_id\s*=\s*v_user/i);
  assert.match(sql, /SECURITY INVOKER/i);
});

test("AutoPilot ignores deleted events but rejects deleted tasks", () => {
  const sql = read(migrations[1]);
  assert.match(sql, /where id\s*=\s*p_task_id[\s\S]*?and deleted_at is null[\s\S]*?for update/i);
  assert.match(sql, /from public\.events\s+where user_id\s*=\s*v_user\s+and deleted_at is null/i);
  assert.match(read(migrations[0]), /from public\.events\s+where user_id\s*=\s*v_user\s+and deleted_at is null/i);
});

test("AutoPilot serializes each user's reservations and rejects overlap or duplicate", () => {
  const sql = read(migrations[1]);
  assert.match(sql, /pg_advisory_xact_lock\(/i);
  assert.match(sql, /starts_at\s*<\s*p_end\s+and ends_at\s*>\s*p_start/i);
  assert.match(sql, /notes\s*=\s*'Tarefa MYRYRA: '\s*\|\|\s*p_task_id::text/i);
  assert.match(sql, /Calendar conflict or duplicate reservation/i);
});
