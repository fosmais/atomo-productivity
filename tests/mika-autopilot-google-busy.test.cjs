const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/mika/autopilot-google-busy.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,require,Date});
const busy=exportsObject.externalBusyIntervals;
const zone="America/Sao_Paulo";
const event={start:"2026-11-24T09:00:00-03:00",end:"2026-11-24T10:00:00-03:00"};
test("timed events block actual instants",()=>{const [v]=busy([event],zone);assert.equal(v.start,Date.parse("2026-11-24T12:00:00Z"));assert.equal(v.end-v.start,3600000)});
test("all-day events use calendar timezone and exclusive end",()=>{const [v]=busy([{start:"2026-11-24",end:"2026-11-25",calendarTimeZone:"Europe/Rome"}],zone);assert.equal(v.start,Date.parse("2026-11-23T23:00:00Z"));assert.equal(v.end,Date.parse("2026-11-24T23:00:00Z"))});
test("cancelled transparent and declined events do not block",()=>assert.equal(busy([{...event,status:"cancelled"},{...event,transparency:"transparent"},{...event,selfResponseStatus:"declined"}],zone).length,0));
test("malformed busy events fail closed",()=>{for(const e of [{...event,start:null},{...event,end:event.start},{...event,start:"2026-11-24T09:00:00"}])assert.throws(()=>busy([e],zone),/Disponibilidade externa inválida/)});

const combine=exportsObject.consolidateBusyIntervals;
test("combined availability preserves internal and external blocks",()=>{const internal=[{start:1,end:2}];const result=combine(internal,{connected:true,events:[event]},zone);assert.equal(result.length,2);assert.equal(result[0].start,1);assert.equal(result[1].start,Date.parse(event.start));assert.equal(internal.length,1)});
test("disconnected calendar preserves internal availability",()=>{const result=combine([{start:1,end:2}],{connected:false,events:[]},zone);assert.equal(result.length,1)});
test("failed or inconsistent external response cannot become free time",()=>{for(const response of [null,{}, {connected:true}, {connected:false,events:[event]}])assert.throws(()=>combine([],response,zone))});
