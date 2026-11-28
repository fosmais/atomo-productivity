const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const source=fs.readFileSync("src/app/api/mika/autopilot/approve/route.ts","utf8");
test("approval re-reads tasks scoped to authenticated user",()=>{assert.match(source,/from\("tasks"\)[\s\S]*?eq\("user_id",user\.id\)[\s\S]*?in\("id",slots\.map/);});
test("approval re-reads internal events scoped to authenticated user",()=>{assert.match(source,/from\("events"\)[\s\S]*?eq\("user_id",user\.id\)/);});
test("approval checks Google availability and fails closed",()=>{assert.ok(source.includes('getGoogleEvents('));assert.ok(source.includes('if(!googleResponse.ok)return reply'));});
test("revalidation must complete before persistence",()=>{assert.ok(source.indexOf('revalidateApprovedSlots(')<source.indexOf('.from("mika_autopilot_approvals").insert'));});
test("stale plans return conflict and are not persisted",()=>{assert.ok(source.includes('return reply({error:"A agenda ou as tarefas mudaram. Gere novas sugestões antes de aprovar."},409)'));});
