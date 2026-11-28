const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const sql=fs.readFileSync("supabase/migrations/20261125015820_mika_autopilot_execution_serialization.sql","utf8");
test("execution takes transaction-scoped per-user advisory lock",()=>assert.match(sql,/pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(p_user_id::text,0\)\)/));
test("approval is locked after acquiring per-user lock",()=>assert.ok(sql.indexOf("pg_advisory_xact_lock")<sql.indexOf("for update")));
test("overlapping slots within a single approval are rejected",()=>assert.ok(sql.includes("APPROVED_SLOTS_OVERLAP")));
test("internal calendar is rechecked after lock",()=>assert.ok(sql.indexOf("pg_advisory_xact_lock")<sql.indexOf("e.blocks_time=true")));
test("only service role can execute the RPC",()=>{assert.match(sql,/revoke all on function[\s\S]*from public,anon,authenticated/i);assert.match(sql,/grant execute on function[\s\S]*to service_role/i)});
