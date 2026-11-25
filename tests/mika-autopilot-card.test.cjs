const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const card=fs.readFileSync("src/app/dashboard/autopilot-card.tsx","utf8"),page=fs.readFileSync("src/app/dashboard/page.tsx","utf8");
test("MIKA Agent AutoPilot card is mounted in dashboard",()=>assert.ok(page.includes("<AutopilotCard />")));
test("card requests read-only daily plan and exposes approval and execution APIs",()=>{assert.ok(card.includes('fetch("/api/mika/daily-plan"'));assert.ok(card.includes('fetch("/api/mika/autopilot/approve"'));assert.ok(card.includes('fetch("/api/mika/autopilot/execute"'));});
test("loading and execution states disable repeated actions",()=>{assert.ok(card.includes("disabled={loading||validating||executing||cancelling||!!approvalId}"));assert.ok(card.includes("disabled={executing||cancelling}"));});
test("failure and empty states are rendered",()=>{assert.ok(card.includes('role="alert"'));assert.ok(card.includes("Nenhuma sugestão disponível"));});
test("task duration fallback and calendar read-only policy are disclosed",()=>{assert.ok(card.includes("estimativa de 25 minutos"));assert.ok(card.includes("Google Calendar permanece somente leitura"));});
test("execution requires a persisted approval id and explicit user click",()=>{assert.match(card,/persisted&&approvalId&&<button/);assert.ok(card.includes('onClick={()=>void executeApproval()}'));});
