const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const sql=fs.readFileSync("supabase/migrations/20261125021000_mika_autopilot_duplicate_task_guard.sql","utf8");
test("database RPC rejects duplicate task ids in one approval",()=>{
 assert.match(sql,/group by x\.value->>'id'[\s\S]*having pg_catalog\.count\(\*\) > 1/i);
 assert.match(sql,/DUPLICATE_APPROVED_TASK/);
});
test("duplicate task guard runs before any event insert",()=>{
 assert.ok(sql.indexOf("DUPLICATE_APPROVED_TASK") < sql.indexOf("insert into public.events"));
});
test("duplicate task guard preserves transaction serialization and approval locking",()=>{
 assert.match(sql,/pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(p_user_id::text,0\)\)/);
 assert.match(sql,/where id=p_approval_id and user_id=p_user_id[\s\S]*for update/i);
});
test("execution RPC remains restricted to service role",()=>{
 assert.match(sql,/revoke all on function[\s\S]*from public,anon,authenticated/i);
 assert.match(sql,/grant execute on function[\s\S]*to service_role/i);
});
