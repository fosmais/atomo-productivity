const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const sql=fs.readFileSync("supabase/migrations/20261125015940_events_prevent_calendar_overlap.sql","utf8");
test("calendar conflict guard is a database trigger for all event writers",()=>assert.match(sql,/before insert or update of user_id,starts_at,ends_at,blocks_time,deleted_at on public\.events/i));
test("trigger serializes event writes per user",()=>assert.match(sql,/pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(new\.user_id::text,0\)\)/));
test("trigger rejects overlapping active time-blocking events",()=>{assert.match(sql,/e\.blocks_time=true/i);assert.match(sql,/e\.starts_at<new\.ends_at/i);assert.match(sql,/e\.ends_at>new\.starts_at/i);assert.match(sql,/errcode='23P01'/i)});
test("soft-deleted and non-blocking events are excluded",()=>{assert.match(sql,/new\.deleted_at is null/i);assert.match(sql,/e\.deleted_at is null/i)});
test("trigger function is not directly executable by clients",()=>assert.match(sql,/revoke all on function public\.prevent_mika_calendar_overlap\(\) from public,anon,authenticated/i));
test("trigger compares events only within the same user",()=>assert.match(sql,/e\.user_id=new\.user_id/i));
test("trigger handles both inserts and time-changing updates",()=>assert.match(sql,/before insert or update of user_id,starts_at,ends_at/i));
