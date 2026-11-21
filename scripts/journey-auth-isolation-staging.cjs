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
  const {data:otherOwn,error:otherOwnError}=await other.db.from("myryra_journeys").select("id").eq("owner_id",other.id).eq("title",fixtureTitle);
  if (otherOwnError) throw otherOwnError;
  assert.equal(otherOwn.length,1,"Other user must own one fixture journey");
  const {data:foreignMissions,error:foreignMissionError}=await owner.db.from("myryra_journey_missions").select("id").eq("journey_id",otherOwn[0].id);
  if (foreignMissionError) throw foreignMissionError;
  assert.equal(foreignMissions.length,0,"Cross-user mission disclosure");
  const {data:otherMissions,error:otherMissionError}=await other.db.from("myryra_journey_missions").select("id,status").eq("journey_id",otherOwn[0].id);
  if (otherMissionError) throw otherMissionError;
  assert.equal(otherMissions.length,1,"Other owner fixture must have exactly one mission");
  assert.equal(otherMissions[0].status,"pending","Foreign fixture must remain pending");
  const attempted=await owner.db.from("myryra_journey_missions").update({status:"pending"}).eq("id",otherMissions[0].id).select("id");
  if (attempted.error) {
    assert.match(attempted.error.code || "",/^(42501|PGRST301)$/,"Unexpected cross-user update failure; check test setup");
  } else {
    assert.equal(attempted.data.length,0,"Cross-user mission update was permitted");
  }
  const {data:unchanged,error:unchangedError}=await other.db.from("myryra_journey_missions").select("status").eq("id",otherMissions[0].id).single();
  if (unchangedError) throw unchangedError;
  assert.equal(unchanged.status,"pending","Cross-user update changed mission status");
  // Direct ledger writes must fail even for the authenticated owner.
  // Use an impossible UUID in a filtered UPDATE: this is safe even if a privilege regresses.
  const ledgerWrite=await owner.db.from("myryra_journey_myra_ledger")
    .update({amount:10}).eq("id","00000000-0000-4000-8000-000000000000").select("id");
  if (ledgerWrite.error) {
    assert.match(ledgerWrite.error.code || "",/^(42501|PGRST301)$/,"Unexpected ledger write failure");
  } else {
    assert.equal(ledgerWrite.data.length,0,"Unexpected ledger write visibility");
  }
  const {data:ledger,error:ledgerError}=await owner.db.from("myryra_journey_myra_ledger").select("id").eq("owner_id",other.id);
  if (ledgerError) throw ledgerError;
  assert.equal(ledger.length,0,"Cross-user ledger disclosure");
 }
  // Anonymous requests must not disclose any Journey or MYRA records.
  const anonymous=client();
  for (const table of ["myryra_journeys","myryra_journey_missions","myryra_journey_myra_ledger"]) {
    const {data,error}=await anonymous.from(table).select("id").limit(1);
    if (error) {
      assert.match(error.code || "",/^(42501|PGRST301)$/,"Unexpected anonymous read failure on "+table);
    } else {
      assert.equal(data.length,0,"Anonymous data disclosure on "+table);
    }
  }
 await Promise.all(owners.map(x=>x.db.auth.signOut()));
 console.log("PASS: two real staging Auth sessions, owner-only journeys, cross-user mission read/write isolation, ledger direct-write and anonymous access denial (safe no-op write attempts)");
}
main().catch(e=>{console.error("Staging Auth isolation test failed:",e.message);process.exitCode=1;});
