const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const source=fs.readFileSync("src/app/api/mika/autopilot/execute/route.ts","utf8");
test("execution requires authentication, MFA and explicit feature flag",()=>{assert.ok(source.includes("authenticateRequest(request)"));assert.ok(source.includes("if(mfaRequired)"));assert.ok(source.includes('MIKA_AUTOPILOT_EXECUTION_ENABLED!=="true"'));});
test("execution is restricted to dedicated homologation project",()=>{assert.ok(source.includes('process.env.VERCEL_ENV!=="preview"'));assert.ok(source.includes('sdwguqyjuvuamfiingsp.supabase.co'));});
test("approval lookup is scoped to authenticated owner",()=>{assert.match(source,/\.eq\("id",body\.approvalId\)\.eq\("user_id",user\.id\)/);});
test("Google Calendar failure blocks all execution",()=>{assert.ok(source.includes("getGoogleEvents("));assert.ok(source.includes("if(!googleResponse.ok)return reply"));});
test("tasks and internal calendar are revalidated before RPC",()=>{assert.ok(source.indexOf("revalidateApprovedSlots(")<source.indexOf('admin.rpc("execute_mika_autopilot_approval"'));});
test("database RPC performs atomic idempotent execution",()=>{assert.ok(source.includes('admin.rpc("execute_mika_autopilot_approval"'));assert.ok(source.includes("idempotent:false"));});
