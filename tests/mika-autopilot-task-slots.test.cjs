const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
function load(name){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/mika/"+name+".ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:p=>load(p.slice(2))});return exports}
const propose=load("autopilot-task-slots").proposeTaskSlots,m=60000,w={start:0,end:120*m},t=(id,extra={})=>({id,importance:3,durationMinutes:30,dependsOn:[],...extra});
test("avoids busy intervals",()=>assert.equal(propose(w,[{start:0,end:60*m}],[t("a")],[],0)[0].start,60*m));
test("priority and no overlap",()=>{const r=propose(w,[],[t("a"),t("b",{importance:5})],[],0);assert.equal(r[0].id,"b");assert.equal(r[0].end,r[1].start)});
test("does not schedule past",()=>assert.equal(propose(w,[],[t("a")],[],60*m)[0].start,60*m));
test("deadline respected",()=>assert.equal(propose(w,[],[t("a",{dueAt:new Date(20*m).toISOString()})],[],0).length,0));
test("pending dependency blocked",()=>assert.equal(propose(w,[],[t("a",{dependsOn:["b"]})],[],0).length,0));
test("approval required",()=>assert.equal(propose(w,[],[t("a")],[],0)[0].requiresApproval,true));
