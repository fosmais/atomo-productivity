const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const source = fs.readFileSync("src/app/api/privacy/health-sharing/route.ts","utf8");
function load({user={id:"a"}, authError=null, assurance={data:{nextLevel:"aal1",currentLevel:"aal1"}}, allowed=true}={}) {
 const calls=[]; const exports={};
 const client={auth:{getUser:async()=>({data:{user},error:authError}),mfa:{getAuthenticatorAssuranceLevel:async()=>assurance}}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require(name){
 if(name==="next/server")return {NextResponse:{json:(body,opts)=>({body,...opts})}};
 if(name.includes("supabase/server"))return {createClient:async()=>client};
 if(name.includes("optional-consent"))return {hasCurrentOptionalConsent:async(...args)=>{calls.push(args);return allowed}};
 throw Error(name);
 }});
 return {get:exports.GET,calls};
}
test("health sharing permits only current consent for authenticated identity",async()=>{const x=load();const r=await x.get();assert.equal(r.status,200);assert.equal(r.body.allowed,true);assert.equal(r.headers["Cache-Control"],"no-store");assert.equal(JSON.stringify(x.calls),JSON.stringify([["a","health_mika_sharing"]]));});
for(const [name,config,status] of [["anonymous",{user:null},401],["auth failure",{authError:{}},401],["MFA required",{assurance:{data:{nextLevel:"aal2",currentLevel:"aal1"}}},403],["MFA failure",{assurance:{error:{}}},403],["missing or revoked consent",{allowed:false},403]])test(name,async()=>{const x=load(config);const r=await x.get();assert.equal(r.status,status);assert.equal(r.body.allowed,false);if(config.allowed!==false)assert.equal(x.calls.length,0);});
