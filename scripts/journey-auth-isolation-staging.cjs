#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- standalone staging-only Node harness */
const assert = require("node:assert/strict");
const { createClient } = require("@supabase/supabase-js");
const URL = "https://xanavauqzsrgvdfhcrsm.supabase.co";
const env = process.env;
const needed = ["MIKA_STAGING_ANON_KEY","MIKA_TEST_EMAIL","MIKA_TEST_PASSWORD","MIKA_TEST_OTHER_EMAIL","MIKA_TEST_OTHER_PASSWORD"];
const missing = needed.filter(k => !env[k]);
if (missing.length) throw new Error("Missing staging-only local variables: "+missing.join(", "));
if (env.MIKA_STAGING_ANON_KEY.startsWith("sb_secret_")) throw new Error("Never use a secret/service-role key");
assert.notEqual(env.MIKA_TEST_EMAIL.toLowerCase(),env.MIKA_TEST_OTHER_EMAIL.toLowerCase());
function client() {
 return createClient(URL,env.MIKA_STAGING_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
async function login(email,password) {
 const db=client();
 const {data,error}=await db.auth.signInWithPassword({email,password});
 if (error || !data.user || !data.session) throw new Error("Synthetic staging sign-in failed");
 return {db,id:data.user.id};
}
async function main() {
 const a=await login(env.MIKA_TEST_EMAIL,env.MIKA_TEST_PASSWORD);
 const b=await login(env.MIKA_TEST_OTHER_EMAIL,env.MIKA_TEST_OTHER_PASSWORD);
 assert.notEqual(a.id,b.id,"Must use two different authenticated users");
 const fixtureTitle="[MYRYRA-STAGING-TEST] Jornada de homologação";
 const owners=[a,b];
 for (const [index,owner] of owners.entries()) {
  const other=owners[1-index];
  const {data:own,error:ownError}=await owner.db.from("myryra_journeys").select("id,owner_id").eq("owner_id",owner.id).eq("title",fixtureTitle);
  if (ownError) throw ownError;
  assert.equal(own.length,1,"Each user must see one synthetic journey");
  const {data:foreign,error:foreignError}=await owner.db.from("myryra_journeys").select("id").eq("owner_id",other.id).eq("title",fixtureTitle);
  if (foreignError) throw foreignError;
  assert.equal(foreign.length,0,"Cross-user journey disclosure");
  const {data:missions,error:missionError}=await owner.db.from("myryra_journey_missions").select("id,status").eq("journey_id",own[0].id);
  if (missionError) throw missionError;
  assert.equal(missions.length,1,"Each fixture should have one mission");
  assert.equal(missions[0].status,"pending","Fixture mission must remain pending");
  const {data:ledger,error:ledgerError}=await owner.db.from("myryra_journey_myra_ledger").select("id").eq("journey_id",other.id);
  if (ledgerError) throw ledgerError;
  assert.equal(ledger.length,0,"Cross-user ledger disclosure");
 }
 await Promise.all(owners.map(x=>x.db.auth.signOut()));
 console.log("PASS: two real staging Auth sessions, owner-only journeys, isolated missions and ledger (read-only)");
}
main().catch(e=>{console.error("Staging Auth isolation test failed:",e.message);process.exitCode=1;});
