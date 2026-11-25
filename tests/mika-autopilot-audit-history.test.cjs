const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const route=fs.readFileSync("src/app/api/mika/autopilot/history/route.ts","utf8");
const sql=fs.readFileSync("supabase/migrations/20261125015604_mika_autopilot_audit_history.sql","utf8");
test("history endpoint requires authenticated user",()=>{assert.ok(route.includes("authenticateRequest(request)"));assert.match(route,/if\(!user\)/);});
test("history query is scoped to authenticated owner",()=>assert.match(route,/\.eq\("user_id",user\.id\)/));
test("history response is non-cacheable and bounded",()=>{assert.ok(route.includes('"Cache-Control":"no-store"'));assert.ok(route.includes("Math.min(100"));});
test("audit table has RLS and owner-only read policy",()=>{assert.match(sql,/enable row level security/i);assert.match(sql,/auth\.uid\(\)=user_id/i);});
test("approval and execution produce audit events",()=>{assert.ok(sql.includes("approval_recorded"));assert.ok(sql.includes("execution_completed"));assert.ok(sql.includes("mika_autopilot_audit(user_id,approval_id,action,event_ids,metadata)"));});
test("audit table denies client writes",()=>{assert.match(sql,/revoke all on public\.mika_autopilot_audit from public,anon,authenticated,service_role/i);assert.match(sql,/grant select on public\.mika_autopilot_audit to authenticated/i);});
