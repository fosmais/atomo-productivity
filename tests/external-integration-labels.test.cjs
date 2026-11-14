const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ui = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/external-integrations.tsx"), "utf8");

test("integration catalog distinguishes manual imports from unavailable providers", () => {
  assert.match(ui, /name: "Todoist"[\s\S]*?status: "Importação manual disponível"/);
  assert.match(ui, /name: "Google Tasks"[\s\S]*?status: "Importação sob demanda disponível"/);
  assert.match(ui, /name: "Microsoft Outlook"[\s\S]*?status: "Em desenvolvimento"/);
  assert.match(ui, /\{integration\.status\}/);
});

test("external integrations never imply automatic writes or completed Outlook connection", () => {
  assert.match(ui, /Google Tasks e Todoist não alteram dados nas contas externas/);
  assert.match(ui, /Outlook permanece em desenvolvimento/);
  assert.doesNotMatch(ui, /MYKA/);
});
