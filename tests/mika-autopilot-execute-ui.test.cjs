const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const source=fs.readFileSync("src/app/dashboard/autopilot-card.tsx","utf8");
test("UI only exposes execution after persisted approval id",()=>{assert.match(source,/persisted&&approvalId&&<button/);});
test("execution action posts only approval identifier to server route",()=>{assert.ok(source.includes('fetch("/api/mika/autopilot/execute"'));assert.ok(source.includes('JSON.stringify({approvalId})'));});
test("UI requires successful execution response",()=>{assert.ok(source.includes('result.executed!==true'));assert.ok(source.includes('Array.isArray(result.eventIds)'));});
test("execution button reports progress and disables duplicate clicks",()=>{assert.ok(source.includes('disabled={executing||cancelling}'));assert.ok(source.includes('"Executando..."'));});
