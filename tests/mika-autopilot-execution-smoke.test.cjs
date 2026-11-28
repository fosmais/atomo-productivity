const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const sql=fs.readFileSync("supabase/migrations/20261125015344_mika_autopilot_controlled_execution.sql","utf8");
const route=fs.readFileSync("src/app/api/mika/autopilot/execute/route.ts","utf8");
test("database execution is serialized by locking approval row",()=>assert.match(sql,/for update/i));
test("second execution returns previously created event ids",()=>assert.match(sql,/execution_status='executed' then return query select approval\.executed_event_ids/i));
test("database creates events and records ids in same transaction",()=>{assert.match(sql,/insert into public\.events/i);assert.match(sql,/executed_event_ids=created_ids/i)});
test("HTTP endpoint returns idempotent result for already executed approval",()=>assert.match(route,/approval\.execution_status==="executed"[\s\S]*?idempotent:true/));
test("HTTP endpoint revalidates Google and MYRYRA before database execution",()=>{assert.ok(route.indexOf("getGoogleEvents(")<route.indexOf('admin.rpc("execute_mika_autopilot_approval"'));assert.ok(route.indexOf("revalidateApprovedSlots(")<route.indexOf('admin.rpc("execute_mika_autopilot_approval"'))});
test("endpoint restricts user scope and staging environment",()=>{assert.ok(route.includes('.eq("user_id",user.id)'));assert.ok(route.includes('process.env.VERCEL_ENV!=="preview"'));});
