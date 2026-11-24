const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
const code=ts.transpileModule(fs.readFileSync("next.config.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const run=(env)=>vm.runInNewContext(code,{process:{env},exports:{}});
const base={VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:"release/myryra-mvp2-final-20261123"};
test("release preview rejects production database",()=>assert.throws(()=>run({...base,NEXT_PUBLIC_SUPABASE_URL:"https://qothgddrvrpeqsprslqk.supabase.co"}),/isolated homologation/));
test("release preview rejects missing database",()=>assert.throws(()=>run(base),/isolated homologation/));
test("release preview accepts isolated database",()=>assert.doesNotThrow(()=>run({...base,NEXT_PUBLIC_SUPABASE_URL:"https://xanavauqzsrgvdfhcrsm.supabase.co"})));
test("production unaffected",()=>assert.doesNotThrow(()=>run({...base,VERCEL_ENV:"production"})));
test("offline CI unaffected",()=>assert.doesNotThrow(()=>run({})));
