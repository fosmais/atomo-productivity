const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const dashboard = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/page.tsx"), "utf8");
const chat = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/copilot-chat.tsx"), "utf8");

test("home does not render the redundant first-steps checklist", () => {
  assert.doesNotMatch(dashboard, /<FirstSteps\b/);
  assert.doesNotMatch(dashboard, /import FirstSteps from/);
});

test("MIKA chat preserves draft and removes optimistic message on request failure", () => {
  assert.match(chat, /setMessages\(previous\s*=>\s*previous\.slice\(0,\s*-1\)\)/);
  assert.match(chat, /setInput\(content\)/);
});

test("MIKA chat rejects non-JSON server responses without logging message bodies", () => {
  assert.match(chat, /contentType\.toLowerCase\(\)\.includes\("application\/json"\)/);
  assert.match(chat, /\[MYKA\] Non-JSON API response/);
  assert.match(chat, /\[MYKA\] Invalid JSON API response/);
});
