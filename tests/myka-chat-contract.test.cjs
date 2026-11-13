const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const chat = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/copilot-chat.tsx"), "utf8");
const concierge = fs.readFileSync(path.join(__dirname, "../src/app/api/concierge/route.ts"), "utf8");

test("MYKA chat accepts omitted optional task and event proposals", () => {
  assert.match(chat, /data\.proposedTask !== undefined &&/);
  assert.match(chat, /data\.proposedEvent !== undefined &&/);
  assert.match(chat, /data\.proposedTask == null/);
  assert.match(chat, /data\.proposedEvent == null/);
});

test("MYKA conversational reply still requires reply and saved message identifiers", () => {
  assert.match(chat, /typeof data\.reply !== "string"/);
  assert.match(chat, /typeof data\.messageId !== "string"/);
  assert.match(chat, /typeof data\.conversationId !== "string"/);
});

test("Concierge keeps server-side authentication and response persistence", () => {
  assert.match(concierge, /authenticateRequest\(request\)/);
  assert.match(concierge, /\.from\("myka_messages"\)/);
  assert.match(concierge, /proposedEvent: parsed\.proposedEvent \?\? null/);
});
