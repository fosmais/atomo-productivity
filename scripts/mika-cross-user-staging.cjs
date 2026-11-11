#!/usr/bin/env node
/**
 * Non-destructive cross-user authorization check (RPC denial attempts are expected) against the approved isolated staging branch.
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
if (url.pathname !== '/' || url.search || url.hash || url.username || url.password || url.port) {
 throw new Error('Expected a clean staging project root URL');
}
const expectedIssuer = url.origin + '/auth/v1';
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
 if (claims.iss !== expectedIssuer) {
  throw new Error('JWT issuer does not match the isolated staging project');
 }
 if (claims.role !== 'authenticated' || !claims.sub || !Number.isFinite(claims.exp) || claims.exp*1000 <= Date.now()) {
  throw new Error('Only unexpired authenticated-user JWTs are permitted');
 }
 return {claims, token, client:createClient(env.MIKA_STAGING_URL,env.MIKA_STAGING_ANON_KEY,{
  global:{headers:{Authorization:'Bearer '+token}},
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
 })};
}
(async () => {
 const owner = userClient(env.MIKA_TEST_ACCESS_TOKEN);
 const other = userClient(env.MIKA_TEST_OTHER_ACCESS_TOKEN);
 assert.notEqual(owner.claims.sub,other.claims.sub,'Two distinct synthetic users are required');
 for (const account of [owner,other]) {
  const {data,error} = await account.client.auth.getUser(account.token);
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
 const anonymous = createClient(env.MIKA_STAGING_URL,env.MIKA_STAGING_ANON_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 });
 const {data:anonProposal,error:anonProposalError} = await anonymous.from('mika_action_proposals')
  .select('id').eq('id',env.MIKA_TEST_PROPOSAL_ID);
 if (anonProposalError) {
  assert.equal(anonProposalError.code,'42501','Anonymous read failed for a reason other than permission denial');
 } else assert.equal(anonProposal.length,0,'Anonymous caller must not read proposal');
 function expectDenied(error, allowedCodes, description) {
  assert.ok(error,description+' must be denied');
  assert.ok(allowedCodes.includes(error.code),description+' returned unexpected error code: '+String(error.code));
 }
 const {error:anonDecisionError} = await anonymous.rpc('mika_decide_proposal',{
  p_proposal_id:env.MIKA_TEST_PROPOSAL_ID,p_approve:true
 });
 expectDenied(anonDecisionError,['28000','42501'],'Anonymous approval');
 const {error:anonExecutionError} = await anonymous.rpc('mika_execute_approved_task',{
  p_proposal_id:env.MIKA_TEST_PROPOSAL_ID,p_plan_id:env.MIKA_TEST_PLAN_ID
 });
 expectDenied(anonExecutionError,['28000','42501'],'Anonymous execution');
 const checks = [
  ['proposal',other.client.from('mika_action_proposals').select('id').eq('id',env.MIKA_TEST_PROPOSAL_ID)],
  ['audit',other.client.from('mika_action_audit').select('id').eq('proposal_id',env.MIKA_TEST_PROPOSAL_ID)],
  ['plan',other.client.from('plans').select('id').eq('id',env.MIKA_TEST_PLAN_ID)],
 ];
 for (const [name,query] of checks) {
  const {data,error} = await query;
  if (error) assert.equal(error.code,'42501','Unexpected '+name+' read error');
  else assert.equal(data.length,0,'Other user must not read owner '+name);
 }
 const {data:ownerAuditBefore,error:auditBeforeError} = await owner.client.from('mika_action_audit')
  .select('id,event_type').eq('proposal_id',env.MIKA_TEST_PROPOSAL_ID).order('id',{ascending:true});
 if (auditBeforeError) throw auditBeforeError;
 const {count:ownerTasksBefore,error:tasksBeforeError} = await owner.client.from('tasks')
  .select('id',{count:'exact',head:true}).eq('plan_id',env.MIKA_TEST_PLAN_ID)
  .eq('user_id',owner.claims.sub).eq('title',proposal.payload.title);
 if (tasksBeforeError) throw tasksBeforeError;
 // Owner cannot execute an approved proposal against a different plan.
 // The wrong-plan check must run before the legitimate concurrency harness.
 if (proposal.status === 'approved') {
  const {error:wrongPlanError} = await owner.client.rpc('mika_execute_approved_task',{
   p_proposal_id:env.MIKA_TEST_PROPOSAL_ID,
   p_plan_id:'00000000-0000-4000-8000-000000000001'
  });
  expectDenied(wrongPlanError,['22023'],'Mismatched plan execution');
 }
 // Unauthorized decision must fail before any state transition.
 const {error:decisionError} = await other.client.rpc('mika_decide_proposal',{
  p_proposal_id:env.MIKA_TEST_PROPOSAL_ID,p_approve:true
 });
 expectDenied(decisionError,['P0002'],'Cross-user approval');
 // Unauthorized execution must fail before creating a task.
 const {error:executionError} = await other.client.rpc('mika_execute_approved_task',{
  p_proposal_id:env.MIKA_TEST_PROPOSAL_ID,p_plan_id:env.MIKA_TEST_PLAN_ID
 });
 expectDenied(executionError,['P0002'],'Cross-user execution');
 const {data:otherAudit,error:otherAuditError} = await other.client.from('mika_action_audit')
  .select('id').eq('proposal_id',env.MIKA_TEST_PROPOSAL_ID);
 if (otherAuditError) assert.equal(otherAuditError.code,'42501','Unexpected cross-user audit read error');
 else assert.equal(otherAudit.length,0,'Other user must not see newly created audit records');
 const {data:after,error:afterError} = await owner.client.from('mika_action_proposals')
  .select('status').eq('id',env.MIKA_TEST_PROPOSAL_ID).single();
 if (afterError) throw afterError;
 assert.equal(after.status,proposal.status,'Unauthorized calls must not mutate proposal status');
 const {data:ownerAuditAfter,error:auditAfterError} = await owner.client.from('mika_action_audit')
  .select('id,event_type').eq('proposal_id',env.MIKA_TEST_PROPOSAL_ID).order('id',{ascending:true});
 if (auditAfterError) throw auditAfterError;
 assert.deepEqual(ownerAuditAfter,ownerAuditBefore,'Unauthorized calls must not add audit events');
 const {count:ownerTasksAfter,error:tasksAfterError} = await owner.client.from('tasks')
  .select('id',{count:'exact',head:true}).eq('plan_id',env.MIKA_TEST_PLAN_ID)
  .eq('user_id',owner.claims.sub).eq('title',proposal.payload.title);
 if (tasksAfterError) throw tasksAfterError;
 assert.equal(ownerTasksAfter,ownerTasksBefore,'Unauthorized calls must not create tasks');
 console.log(JSON.stringify({outcome:'PASS',cross_user_read_denied:true,cross_user_decision_denied:true,cross_user_execution_denied:true,anonymous_access_denied:true}));
})().catch(error=>{console.error('MIKA cross-user staging test FAILED:',error.message);process.exitCode=1;});
