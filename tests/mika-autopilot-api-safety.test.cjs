const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const source=fs.readFileSync("src/app/api/mika/daily-plan/route.ts", "utf8").replace(/\r\n/g, "\n");
test("daily plan scopes all three queries to authenticated user",()=>assert.equal((source.match(/\.eq\("user_id",\s*user\.id\)/g)||[]).length,3));
test("daily plan excludes deleted records",()=>assert.equal((source.match(/\.is\("deleted_at", null\)/g)||[]).length,2));
test("daily plan rejects truncated results before suggestions",()=>{assert.equal((source.match(/\.limit\(201\)/g)||[]).length,2);assert.ok(source.indexOf("status:422")<source.indexOf("const autopilot:"))});
test("autopilot excludes dated tasks and respects all saved events",()=>{assert.ok(source.includes("filter(t=>!t.due_date)"));assert.ok(source.includes("const busy = (eventsResult.data ?? []).map"))});
test("daily plan does not mutate database",()=>assert.doesNotMatch(source,/\.(insert|update|upsert|delete|rpc)\(/));
test("autopilot response identifies estimate and read-only scope",()=>{assert.ok(source.includes('fallbackMinutes:25, scope:"undated_tasks_only", mode:"read_only"'));assert.ok(source.includes('"Cache-Control": "no-store"'))});

test("autopilot uses owned planning preferences and clips windows",()=>{assert.ok(source.includes('.from("planning_preferences")'));assert.ok(source.includes("generatePlanningWindows(preferences"));assert.ok(source.includes("Math.min(end,w.end.getTime())"));assert.ok(source.includes("preferencesResult.error"))});

test("autopilot prioritizes candidates before applying engine capacity",()=>{
  const expression=source.match(/const candidates = ([\s\S]*?);\n    const busy/);
  assert.ok(expression);
  const tasks=Array.from({length:150},(_,i)=>({id:String(i).padStart(3,"0"),priority:"baixa",duration_minutes:25,due_date:null}));
  tasks.push({id:"urgent",priority:"alta",duration_minutes:45,due_date:null});
  tasks.push({id:"dated",priority:"alta",duration_minutes:30,due_date:"2026-11-25"});
  const candidates=require("node:vm").runInNewContext(expression[1],{tasksResult:{data:tasks}});
  assert.equal(candidates.length,100);
  assert.equal(candidates[0].id,"urgent");
  assert.equal(candidates[0].durationMinutes,45);
  assert.ok(!candidates.some(t=>t.id==="dated"));
});

test("configured day uses authenticated planning timezone before event query",()=>{
  assert.ok(source.includes('configuredToday === true'));
  assert.ok(source.includes('preferencesResult.data?.time_zone'));
  assert.ok(source.indexOf('if (configuredToday)')<source.indexOf('.from("events")'));
  assert.ok(source.includes('local.getDate()+1'));
  assert.ok(source.includes('configuredToday ? 26*3600000 : 86400000'));
});

test("external availability is checked before proposing slots",()=>{
 assert.ok(source.includes('if(!googleResponse.ok)'));
 assert.ok(source.indexOf('if(!googleResponse.ok)')<source.indexOf('const combinedBusy='));
 assert.ok(source.includes('consolidateBusyIntervals(busy,external,preferences.timeZone)'));
 assert.ok(source.includes('end:to},combinedBusy,candidates'));
 assert.ok(source.includes('EXTERNAL_AVAILABILITY_UNAVAILABLE'));
});
