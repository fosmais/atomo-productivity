const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const card=fs.readFileSync("src/app/dashboard/autopilot-card.tsx","utf8"),briefing=fs.readFileSync("src/app/dashboard/daily-briefing.tsx","utf8");
test("card mounted in daily briefing",()=>assert.match(briefing,/<AutopilotCard\s*\/>/));
test("card calls read-only daily plan",()=>assert.ok(card.includes('fetch("/api/mika/daily-plan"')));
test("loading disables request button",()=>assert.ok(card.includes("disabled={loading}")));
test("failure and empty state rendered",()=>{assert.ok(card.includes('role="alert"'));assert.ok(card.includes("Nenhuma sugestão disponível"))});
test("estimate and external calendar limitation disclosed",()=>{assert.ok(card.includes("25 min estimados"));assert.ok(card.includes("Calendários externos não são considerados"))});
test("card has no execution endpoint",()=>assert.equal((card.match(/fetch\(/g)||[]).length,1));
