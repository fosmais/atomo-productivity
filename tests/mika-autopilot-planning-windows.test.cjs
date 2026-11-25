const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/planning-windows.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,require,Date});
const generate=exportsObject.generatePlanningWindows;
const pref={startTime:"09:00",endTime:"18:00",weekdays:[1,2,3,4,5],timeZone:"America/Sao_Paulo"};
test("Sao Paulo working hours are converted to UTC",()=>{const [w]=generate(pref,new Date("2026-11-23T00:00:00-03:00"),1);assert.equal(w.start.toISOString(),"2026-11-23T12:00:00.000Z");assert.equal(w.end.toISOString(),"2026-11-23T21:00:00.000Z")});
test("weekends are excluded",()=>assert.equal(generate(pref,new Date("2026-11-28T00:00:00-03:00"),2).length,0));
test("elapsed working hours are clipped",()=>{const [w]=generate(pref,new Date("2026-11-23T15:00:00Z"),1);assert.equal(w.start.toISOString(),"2026-11-23T15:00:00.000Z")});
test("Rome daylight saving is respected",()=>{const p={...pref,timeZone:"Europe/Rome"};assert.equal(generate(p,new Date("2026-07-06T00:00:00+02:00"),1)[0].start.toISOString(),"2026-07-06T07:00:00.000Z");assert.equal(generate(p,new Date("2026-11-23T00:00:00+01:00"),1)[0].start.toISOString(),"2026-11-23T08:00:00.000Z")});
