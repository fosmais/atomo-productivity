#!/usr/bin/env node
/**
 * Read-only cross-user authorization check against the approved isolated staging branch.
 * Requires two distinct synthetic authenticated users. Never use production tokens.
 * MIKA_STAGING_URL, MIKA_STAGING_ANON_KEY, MIKA_TEST_ACCESS_TOKEN,
 * MIKA_TEST_OTHER_ACCESS_TOKEN, MIKA_TEST_PROPOSAL_ID, MIKA_TEST_PLAN_ID.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- standalone staging harness */
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');

const env = process.env;
const required = ['MIKA_STAGING_URL','MIKA_STAGING_ANON_KEY','MIKA_TEST_ACCESS_TOKEN','MIKA_TEST_OTHER_ACCESS_TOKEN','MIKA_TEST_PROPOSAL_ID','MIKA_TEST_PLAN_ID'];
const missing = required.filter(k => !env[k]);
if (missing.length) throw new Error('Missing staging settings: '+missing.join(', '));
const url = new URL(env.MIKA_STAGING_URL);
if (url.protocol !== 'https:' || url.hostname !== 'xanavauqzsrgvdfhcrsm.supabase.co') {
 throw new Error('Only the approved isolated MYRYRA staging branch is permitted');
}
if (env.MIKA_STAGING_ANON_KEY.startsWith('sb_secret_')) throw new Error('Secret keys are forbidden');
for (const id of [env.MIKA_TEST_PROPOSAL_ID,env.MIKA_TEST_PLAN_ID]) {
 if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid UUID');
}
function userClient(token) {
 const parts = token.split('.');
 if (parts.length !== 3) throw new Error('Expected user JWT');
 let claims;
 try { claims = JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8')); }
 catch { throw new Error('Invalid user JWT'); }
 if (claims.role !== 'authenticated' || !claims.sub || !Number.isFinite(claims.exp) || claims.exp*1000 <= Date.now()) {
  throw new Error('Only unexpired authenticated-user JWTs are permitted');
 }
 return {claims, client:createClient(env.MIKA_STAGING_URL,env.MIKA_STAGING_ANON_KEY,{
  global:{headers:{Authorization:'Bearer '+token}},
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
 })};
}
(async () => {
 const owner = userClient(env.MIKA_TEST_ACCESS_TOKEN);
 const other = userClient(env.MIKA_TEST_OTHER_ACCESS_TOKEN);
 assert.notEqual(owner.claims.sub,other.claims.sub,'Two distinct synthetic users are required');
 for (const account of [owner,other]) {
  const {data,error} = await account.client.auth.getUser();
  if (error || data?.user?.id !== account.claims.sub) throw new Error('Unable to verify authenticated test identity');
 }
 const {data:proposal,error:proposalError} = await owner.client.from('mika_action_proposals')
  .select('id,user_id,status,payload').eq('id',env.MIKA_TEST_PROPOSAL_ID).single();
 if (proposalError) throw proposalError;
 assert.equal(proposal.user_id,owner.claims.sub);
 assert.match(proposal.payload.title,/^\[MIKA-STAGING-TEST\]/);
 assert.equal(proposal.payload.plan_id,env.MIKA_TEST_PLAN_ID);
 const {data:plan,error:planError} = await owner.client.from('plans')
  .select('id,user_id,title').eq('id',env.MIKA_TEST_PLAN_ID).single();
 if (planError) throw planError;
 assert.equal(plan.user_id,owner.claims.sub);
 assert.match(plan.title,/^\[MIKA-STAGING-TEST\]/);
 const checks = [
  ['proposal',other.client.from('mika_action_proposals').select('id').eq('id',env.MIKA_TEST_PROPOSAL_ID)],
  ['audit',other.client.from('mika_action_audit').select('id').eq('proposal_id',env.MIKA_TEST_PROPOSAL_ID)],
  ['plan',other.client.from('plans').select('id').eq('id',env.MIKA_TEST_PLAN_ID)],
 ];
 for (const [name,query] of checks) {
  const {data,error} = await query;
  if (error) throw new Error(name+': '+error.message);
  assert.equal(data.length,0,'Other user must not read owner '+name);
 }
 // Unauthorized decision must fail before any state transition.
 const {error:decisionError} = await other.client.rpc('mika_decide_proposal',{
  p_proposal_id:env.MIKA_TEST_PROPOSAL_ID,p_approve:true
 });
 assert.ok(decisionError,'Cross-user approval must be rejected');
 // Unauthorized execution must fail before creating a task.
 const {error:executionError} = await other.client.rpc('mika_execute_approved_task',{
  p_proposal_id:env.MIKA_TEST_PROPOSAL_ID,p_plan_id:env.MIKA_TEST_PLAN_ID
 });
 assert.ok(executionError,'Cross-user execution must be rejected');
 const {data:after,error:afterError} = await owner.client.from('mika_action_proposals')
  .select('status').eq('id',env.MIKA_TEST_PROPOSAL_ID).single();
 if (afterError) throw afterError;
 assert.equal(after.status,proposal.status,'Unauthorized calls must not mutate proposal status');
 console.log(JSON.stringify({outcome:'PASS',cross_user_read_denied:true,cross_user_decision_denied:true,cross_user_execution_denied:true}));
})().catch(error=>{console.error('MIKA cross-user staging test FAILED:',error.message);process.exitCode=1;});
