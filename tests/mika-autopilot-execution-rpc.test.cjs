const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const sql=fs.readFileSync("supabase/migrations/20261125015344_mika_autopilot_controlled_execution.sql","utf8");
test("execution locks approval row and rejects expired approvals",()=>{assert.match(sql,/for update/i);assert.match(sql,/approval\.expires_at <= pg_catalog\.now\(\)/i)});
test("execution is idempotent for already executed approval",()=>{assert.match(sql,/execution_status='executed' then return query select approval\.executed_event_ids/i)});
test("execution rechecks task ownership and eligibility",()=>{assert.match(sql,/user_id=p_user_id for update/i);assert.match(sql,/task_row\.completed or task_row\.deleted_at is not null/i)});
test("execution checks internal calendar conflicts and slot overlaps",()=>{assert.match(sql,/e\.blocks_time=true and e\.starts_at<slot_end and e\.ends_at>slot_start/i);assert.match(sql,/APPROVED_SLOTS_OVERLAP/i)});
test("execution creates MYRYRA events and records their ids atomically",()=>{assert.match(sql,/insert into public\.events/i);assert.match(sql,/execution_status='executed',executed_at=pg_catalog\.now\(\),executed_event_ids=created_ids/i)});
test("only service role may call execution rpc",()=>{assert.match(sql,/revoke all on function[\s\S]*from public,anon,authenticated/i);assert.match(sql,/grant execute on function[\s\S]*to service_role/i)});
