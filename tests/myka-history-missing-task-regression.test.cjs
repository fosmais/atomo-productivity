const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const api = fs.readFileSync(path.join(__dirname, "../src/app/api/myka/history/route.ts"), "utf8");
const chat = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/copilot-chat.tsx"), "utf8");

test("history loads task reference to detect missing confirmed tasks", () => {
  assert.match(api, /\.select\("message_id, task_index, decision, task_id"\)/);
  assert.match(api, /taskMissing:\s*item\.decision === "saved" && item\.task_id === null/);
});

test("chat restores the missing task flag from server response", () => {
  assert.match(chat, /taskMissing:\s*decision\.taskMissing === true/);
});

test("chat does not claim a missing task was definitely deleted", () => {
  assert.match(chat, /possivelmente excluída/);
});
