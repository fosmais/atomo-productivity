const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const api=read("src/app/api/mika/autopilot/cancel/route.ts");
const card=read("src/app/dashboard/autopilot-card.tsx");
const history=read("src/app/dashboard/autopilot-history.tsx");
const execute=read("src/app/api/mika/autopilot/execute/route.ts");
test("cancel route requires authenticated owner, MFA and dedicated preview",()=>{
 assert.match(api,/if\(!user\)/);assert.match(api,/if\(mfaRequired\)/);assert.match(api,/if\(assuranceUnavailable\)/);
 assert.ok(api.includes('MIKA_AUTOPILOT_PERSIST_ENABLED!=="true"'));assert.ok(api.includes('sdwguqyjuvuamfiingsp.supabase.co'));
 assert.ok(api.includes('p_user_id:user.id'));assert.ok(api.includes('checkConciergeRateLimit(user.id)'));
});
test("cancel endpoint validates input and maps conflicts",()=>{
 assert.ok(api.includes('raw.length>4096'));assert.ok(api.includes('JSON.parse(raw)'));assert.ok(api.includes('error?.code==="P0002"'));assert.ok(api.includes('error?.code==="P0001"'));
});
test("card prevents concurrent execution and cancellation",()=>{
 assert.ok(card.includes('if(!approvalId||executing||cancelling)return'));assert.ok(card.includes('disabled={executing||cancelling}'));
 assert.ok(card.includes('onClick={()=>void cancelApproval()}'));assert.ok(card.includes('result.cancelled!==true'));
 assert.ok(card.includes('setApprovalId(null);setPersisted(false);setItems(null)'));
});
test("history labels cancellation and execution rejects nonpending approval",()=>{
 assert.ok(history.includes('item.action==="approval_cancelled"?"Autorização cancelada"'));
 assert.ok(execute.includes('approval.execution_status!=="pending"'));
});
