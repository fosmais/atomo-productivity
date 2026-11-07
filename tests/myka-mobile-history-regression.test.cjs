const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../apps/mobile/src/components/MykaHistory.tsx"), "utf8");

test("mobile reads task decisions scoped to authenticated user and loaded messages", () => {
  assert.match(source, /\.from\("myka_task_confirmations"\)/);
  assert.match(source, /\.eq\("user_id", userId\)/);
  assert.match(source, /\.in\("message_id", assistantIds\)/);
});

test("mobile distinguishes saved, cancelled and missing task references", () => {
  assert.match(source, /item\.decision === "cancelled"/);
  assert.match(source, /item\.task_id === null/);
  assert.match(source, /possivelmente excluída/);
});

test("mobile renders decision summaries without mutating tasks", () => {
  assert.match(source, /message\.taskSummary \? <Text/);
  assert.doesNotMatch(source, /\.from\("myka_task_confirmations"\)\s*\.insert\(/);
});

test("mobile orders task decisions by original proposal index", () => {
  assert.match(source, /\.order\("task_index", \{ ascending: true \}\)/);
});
