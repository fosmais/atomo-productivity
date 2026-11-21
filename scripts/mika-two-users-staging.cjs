#!/usr/bin/env node
/**
 * Bootstrap TWO isolated MIKA staging identities using official Supabase Auth.
 * Run locally; never commit credentials or use production accounts.
 *
 * MIKA_STAGING_ANON_KEY, MIKA_TEST_EMAIL, MIKA_TEST_PASSWORD,
 * MIKA_TEST_OTHER_EMAIL, MIKA_TEST_OTHER_PASSWORD
 *
 * No access tokens or passwords are printed.
 * If email confirmation is required, confirm both addresses and rerun.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const url = 'https://xanavauqzsrgvdfhcrsm.supabase.co';
const env = process.env;
const required = ['MIKA_STAGING_ANON_KEY','MIKA_TEST_EMAIL','MIKA_TEST_PASSWORD','MIKA_TEST_OTHER_EMAIL','MIKA_TEST_OTHER_PASSWORD'];
const missing = required.filter(k => !env[k]);
if (missing.length) throw new Error('Missing local staging variables: '+missing.join(', '));
if (env.MIKA_STAGING_ANON_KEY.startsWith('sb_secret_')) throw new Error('Secret/service role key is forbidden');
for (const email of [env.MIKA_TEST_EMAIL,env.MIKA_TEST_OTHER_EMAIL]) {
 if (!/^mika-staging-test[+._a-z0-9-]*@[^@]+\.[^@]+$/i.test(email)) throw new Error('Use dedicated mika-staging-test... synthetic emails');
}
assert.notEqual(env.MIKA_TEST_EMAIL.toLowerCase(),env.MIKA_TEST_OTHER_EMAIL.toLowerCase(),'Use two different synthetic emails');
for (const password of [env.MIKA_TEST_PASSWORD,env.MIKA_TEST_OTHER_PASSWORD]) {
 if (password.length < 12) throw new Error('Use strong synthetic passwords (at least 12 characters)');
}
const makeClient = () => createClient(url,env.MIKA_STAGING_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
async function identity(email,password) {
 const client=makeClient();
 let login=await client.auth.signInWithPassword({email,password});
 if (login.error || !login.data.session) {
  const signup=await client.auth.signUp({email,password});
  if (signup.error) throw new Error('Signup failed for synthetic identity: '+signup.error.message);
  if (!signup.data.session) return {status:'EMAIL_CONFIRMATION_REQUIRED'};
  login={data:signup.data,error:null};
 }
 const token=login.data.session.access_token;
 const {data,error}=await client.auth.getUser(token);
 if (error || !data?.user || data.user.email?.toLowerCase()!==email.toLowerCase()) {
  throw new Error('Supabase Auth identity verification failed');
 }
 await client.auth.signOut();
 return {status:'VERIFIED',user_id:data.user.id};
}
(async()=>{
 const owner=await identity(env.MIKA_TEST_EMAIL,env.MIKA_TEST_PASSWORD);
 const other=await identity(env.MIKA_TEST_OTHER_EMAIL,env.MIKA_TEST_OTHER_PASSWORD);
 if (owner.status !== 'VERIFIED' || other.status !== 'VERIFIED') {
  throw new Error('Staging Auth email confirmation is required for one or both synthetic accounts; confirm both addresses before rerunning');
 }
 assert.notEqual(owner.user_id,other.user_id);
 console.log(JSON.stringify({project:'xanavauqzsrgvdfhcrsm',owner,other,next:'Run the existing single-user fixture for the owner after both identities are verified'},null,2));
})().catch(e=>{console.error('MIKA staging identity bootstrap failed:',e.message);process.exitCode=1;});
