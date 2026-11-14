#!/usr/bin/env node
/**
 * Safe bootstrap for a staging-only MIKA concurrency test account.
 * Uses the official Supabase Auth API, never inserts into auth.users.
 * Environment: MIKA_TEST_EMAIL, MIKA_TEST_PASSWORD, MIKA_STAGING_ANON_KEY
 * Optional: MIKA_TEST_ACCESS_TOKEN (existing verified user session).
 * Do not store credentials in Git or CI logs.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node CommonJS staging utility */
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const env = process.env;
const url = 'https://xanavauqzsrgvdfhcrsm.supabase.co';
const key = env.MIKA_STAGING_ANON_KEY;
if (!key || key.startsWith('sb_secret_')) throw new Error('A staging publishable/anon key is required');
if (!env.MIKA_TEST_EMAIL || !env.MIKA_TEST_PASSWORD) throw new Error('Set MIKA_TEST_EMAIL and MIKA_TEST_PASSWORD locally');
if (env.MIKA_TEST_PASSWORD.length < 12) throw new Error('Use a strong synthetic account password');
const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
(async () => {
 let session;
 if (env.MIKA_TEST_ACCESS_TOKEN) {
  const {data,error} = await client.auth.getUser(env.MIKA_TEST_ACCESS_TOKEN);
  if (error || !data?.user) throw new Error('Invalid test access token');
  if (data.user.email?.toLowerCase() !== env.MIKA_TEST_EMAIL.toLowerCase()) throw new Error('Token user does not match synthetic email');
  session = {access_token:env.MIKA_TEST_ACCESS_TOKEN,user:data.user};
 } else {
  const login = await client.auth.signInWithPassword({email:env.MIKA_TEST_EMAIL,password:env.MIKA_TEST_PASSWORD});
  if (!login.error && login.data.session) session = login.data.session;
  else {
   const signup = await client.auth.signUp({email:env.MIKA_TEST_EMAIL,password:env.MIKA_TEST_PASSWORD});
   if (signup.error) throw new Error('Sign-in/sign-up unavailable: '+signup.error.message);
   if (!signup.data.session) {
    console.log('Account signup requested. Confirm the email if required, then rerun this script.');
    return;
   }
   session = signup.data.session;
  }
 }
 const {data:identity,error:identityError}=await client.auth.getUser(session.access_token);
 if (identityError || !identity?.user || identity.user.id !== session.user.id) throw new Error('Auth identity verification failed');
 const authed = createClient(url,key,{global:{headers:{Authorization:'Bearer '+session.access_token}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data:plans,error:lookupError}=await authed.from('plans').select('id,title').like('title','[MIKA-STAGING-TEST]%').limit(1);
 if (lookupError) throw lookupError;
 let plan=plans?.[0];
 if (!plan) {
  const result=await authed.from('plans').insert({user_id:identity.user.id,title:'[MIKA-STAGING-TEST] Concurrency fixture'}).select('id,title').single();
  if (result.error) throw result.error;
  plan=result.data;
 }
 assert.match(plan.title,/^\[MIKA-STAGING-TEST\]/);
 console.log(JSON.stringify({status:'READY_FOR_PROPOSAL',project:'xanavauqzsrgvdfhcrsm',user_id:identity.user.id,plan_id:plan.id}));
 console.log('Keep the access token private. Prepare an approved synthetic proposal via the authorized staging fixture process, then run mika-concurrency-staging.cjs.');
})().catch(e=>{console.error('Staging bootstrap failed:',e.message);process.exitCode=1;});
