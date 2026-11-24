const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const source = fs.readFileSync("src/lib/privacy/optional-consent.ts", "utf8");
function load({user="a", purpose={purpose_version:2,required:false,legal_basis:"consent"}, choices=[{granted:true}], error=null}={}) {
  const filters=[];
  const client={auth:{getUser:async()=>({data:{user:{id:user}}})},from(table){
    const q={select(){return q},eq(k,v){filters.push([table,k,v]);return q},order(){return q},limit(){return q},maybeSingle:async()=>({data:purpose,error}),then(resolve){return Promise.resolve({data:choices,error}).then(resolve)}};
    return q;
  }};
  const exports={};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(name)=>name==="server-only"?{}:{createClient:async()=>client}});
  return {check:exports.hasCurrentOptionalConsent,filters};
}
test("current optional consent allows matching user and version",async()=>{const {check,filters}=load();assert.equal(await check("a","optional_test"),true);assert.ok(filters.some(x=>x[1]==="purpose_version"&&x[2]===2));});
for(const [name,config] of [["revoked",{choices:[{granted:false}]}],["missing",{choices:[]}],["other user",{user:"b"}],["missing purpose",{purpose:null}],["required purpose",{purpose:{required:true,legal_basis:"consent"}}],["different legal basis",{purpose:{required:false,legal_basis:"contract"}}],["query failure",{error:{message:"unavailable"}}]]) test(name+" fails closed",async()=>assert.equal(await load(config).check("a","optional_test"),false));
test("revocation wins timestamp ties in query ordering",()=>assert.match(source,/order\("occurred_at", \{ ascending: false \}\)\.order\("granted", \{ ascending: true \}\)/));
