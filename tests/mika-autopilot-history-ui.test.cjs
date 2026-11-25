const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const panel=fs.readFileSync("src/app/dashboard/autopilot-history.tsx","utf8");
const page=fs.readFileSync("src/app/dashboard/page.tsx","utf8");
test("history panel fetches authenticated no-store API",()=>{assert.ok(panel.includes('fetch("/api/mika/autopilot/history?limit=50",{cache:"no-store"})'));});
test("history panel renders approval and execution records",()=>{assert.ok(panel.includes('"Autorização registrada"'));assert.ok(panel.includes('"Compromissos criados"'));});
test("history panel exposes refresh and empty states",()=>{assert.ok(panel.includes("Atualizar"));assert.ok(panel.includes("Nenhuma atividade registrada"));});
test("dashboard exposes history within scheduling workspace",()=>{assert.ok(page.includes('import AutopilotHistory from "./autopilot-history"'));assert.ok(page.includes('id="autopilot-history"'));});
