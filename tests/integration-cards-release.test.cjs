const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const cards = fs.readFileSync(path.join(root, "src/app/dashboard/integration-status-cards.tsx"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "src/app/dashboard/page.tsx"), "utf8");

test("integration cards identify the three providers", () => {
  for (const name of ["Google Tasks", "Todoist", "Microsoft Outlook"]) {
    assert.ok(cards.includes(name), `Missing provider: ${name}`);
  }
});

test("dashboard mounts cards behind authenticated session", () => {
  assert.match(dashboard, /import IntegrationStatusCards from/);
  assert.match(dashboard, /supabase\.auth\.getUser\(\)/);
  assert.match(dashboard, /redirect\("\/login"\)/);
  assert.ok(dashboard.indexOf("<IntegrationStatusCards />") > dashboard.indexOf("redirect(\"/login\")"));
});

test("cards remain informational, with no OAuth, mutations or external API calls", () => {
  assert.match(cards, /ainda não estão disponíveis/);
  const executableSource = cards.replace(/https?:\/\/[^"\s]+/g, "EXTERNAL_DOC_URL");
  assert.doesNotMatch(executableSource, /\bfetch\s*\(|\baxios\b|\buseEffect\s*\(|\/api\/|connect\s*\(/);
  assert.match(cards, /rel="noopener noreferrer"/);
});
