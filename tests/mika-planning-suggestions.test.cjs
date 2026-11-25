const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
function load(name){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/mika/"+name+".ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:p=>load(p.slice(2))});return exports}
const suggest=load("planning-suggestions").suggestMikaActions,now=Date.parse("2026-11-25T12:00Z");
const a=(id,extra={})=>({id,title:id,kind:"create_task",dependsOn:[],importance:3,durationMinutes:20,...extra});
const run=(actions,done=[],minutes=60)=>suggest(actions,done,minutes,now);
test("total budget",()=>assert.equal(run([a("a"),a("b"),a("c")],[],40).length,2));
test("priority determines selection",()=>assert.equal(run([a("a"),a("b",{importance:5})],[],20)[0].id,"b"));
test("completed dependency permits suggestion",()=>assert.equal(run([a("a"),a("b",{dependsOn:["a"]})],["a"])[0].id,"b"));
test("pending dependency prevents suggestion",()=>assert.equal(run([a("a"),a("b",{dependsOn:["a"]})]).length,1));
test("all completed returns empty",()=>assert.equal(run([a("a")],["a"]).length,0));
test("invalid dependency rejected",()=>assert.throws(()=>run([a("a",{dependsOn:["missing"]})]),/missing_dependency/));
test("cycle rejected",()=>assert.throws(()=>run([a("a",{dependsOn:["b"]}),a("b",{dependsOn:["a"]})]),/cyclic_dependency/));
test("all suggestions require approval",()=>assert.ok(run([a("a"),a("b")]).every(x=>x.requiresApproval===true)));
