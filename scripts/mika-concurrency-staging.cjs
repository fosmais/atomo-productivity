#!/usr/bin/env node
/**
 * Manual staging-only concurrency check. Requires an approved, unexecuted
 * create_task proposal whose payload.plan_id matches MIKA_TEST_PLAN_ID.
 * Twenty independent clients use the same test user's token to simulate competing HTTP calls.
 * No production credentials or service-role key should ever be used.
 *
 * MIKA_STAGING_URL=... MIKA_STAGING_ANON_KEY=...
 * MIKA_TEST_ACCESS_TOKEN=... MIKA_TEST_PROPOSAL_ID=... MIKA_TEST_PLAN_ID=...
 * node scripts/mika-concurrency-staging.cjs
 */
/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node CommonJS staging harness */
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');

const env = process.env;
const required = ['MIKA_STAGING_URL','MIKA_STAGING_ANON_KEY','MIKA_TEST_ACCESS_TOKEN','MIKA_TEST_PROPOSAL_ID','MIKA_TEST_PLAN_ID'];
const missing = required.filter(k => !env[k]);
if (missing.length) { console.error('Missing staging test settings:', missing.join(', ')); process.exit(2); }
const url = new URL(env.MIKA_STAGING_URL);
if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) throw new Error('Expected a Supabase HTTPS staging URL');
if (url.hostname !== 'xanavauqzsrgvdfhcrsm.supabase.co') throw new Error('Only the approved isolated finance homologation project is permitted');
if (!/^[0-9a-f-]{36}$/i.test(env.MIKA_TEST_PROPOSAL_ID) || !/^[0-9a-f-]{36}$/i.test(env.MIKA_TEST_PLAN_ID)) throw new Error('Invalid UUID');
if (env.MIKA_STAGING_ANON_KEY.startsWith('sb_secret_')) throw new Error('Secret API keys are forbidden for this test');
const tokenParts = env.MIKA_TEST_ACCESS_TOKEN.split('.');
if (tokenParts.length !== 3) throw new Error('Expected a user JWT access token');
let claims;
try { claims = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString('utf8')); }
catch { throw new Error('Malformed user access token'); }
if (claims.role !== 'authenticated' || !claims.sub || claims.exp * 1000 <= Date.now()) {
 throw new Error('Requires a valid unexpired authenticated-user token, not a service token');
}
const makeClient = () => createClient(env.MIKA_STAGING_URL, env.MIKA_STAGING_ANON_KEY, {
 global: { headers: { Authorization: 'Bearer ' + env.MIKA_TEST_ACCESS_TOKEN } },
 auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const a = makeClient();
const CONCURRENT_CLAIMS = 20;
(async () => {
 const { data: identity, error: identityError } = await a.auth.getUser(env.MIKA_TEST_ACCESS_TOKEN);
 if (identityError || !identity?.user || identity.user.id !== claims.sub) {
  throw new Error('Authenticated test user could not be verified');
 }
 const { data: before, error: beforeError } = await a.from('mika_action_proposals')
  .select('id,status,action_type,payload').eq('id',env.MIKA_TEST_PROPOSAL_ID).single();
 if (beforeError) throw beforeError;
 assert.equal(before.status,'approved','Requires an approved, unexecuted proposal');
 assert.equal(before.action_type,'create_task');
 assert.match(before.payload.title, /^\[MIKA-STAGING-TEST\]/, 'Only explicitly marked synthetic proposals may be executed');
 assert.equal(before.payload.plan_id,env.MIKA_TEST_PLAN_ID);
 const { data: plan, error: planError } = await a.from('plans')
  .select('id,user_id,title').eq('id',env.MIKA_TEST_PLAN_ID).single();
 if (planError) throw planError;
 assert.equal(plan.user_id,identity.user.id,'Plan must belong to the authenticated test user');
 assert.match(plan.title, /^\[MIKA-STAGING-TEST\]/, 'Only synthetic test plans may be used');
 const { data: existingAudit, error: auditBeforeError } = await a.from('mika_action_audit')
  .select('id').eq('proposal_id',env.MIKA_TEST_PROPOSAL_ID).eq('event_type','succeeded');
 if (auditBeforeError) throw auditBeforeError;
 assert.equal(existingAudit.length,0,'Test proposal must have no previous success audit');
 const { count: priorMatchingTasks, error: priorTaskError } = await a.from('tasks')
  .select('id', { count: 'exact', head: true }).eq('plan_id', env.MIKA_TEST_PLAN_ID)
  .eq('user_id', identity.user.id).eq('title', before.payload.title);
 if (priorTaskError) throw priorTaskError;
 assert.equal(priorMatchingTasks, 0, 'Synthetic task title must be unique before concurrency test');
 const args = { p_proposal_id: env.MIKA_TEST_PROPOSAL_ID, p_plan_id: env.MIKA_TEST_PLAN_ID };
 const started = Date.now();
 const responses = await Promise.all(Array.from({length: CONCURRENT_CLAIMS}, () =>
  makeClient().rpc('mika_execute_approved_task',args)
 ));
 for (const response of responses) if (response.error) throw response.error;
 const results = responses.map(x => Array.isArray(x.data) ? x.data[0] : x.data);
 assert.equal(results.filter(x=>x.execution_status==='executed').length,1,'Exactly one claim must execute');
 assert.equal(results.filter(x=>x.execution_status==='already_executed').length,CONCURRENT_CLAIMS-1,'All replay claims must be idempotent');
 const taskId = results.find(x=>x.execution_status==='executed').task_id;
 assert.ok(taskId);
 assert.ok(results.every(x=>x.task_id===taskId),'All claims must return the same task');
 const [{data:proposal,error:pErr},{data:audit,error:aErr},{data:tasks,error:tErr},{count:matchingTasks,error:countErr}] = await Promise.all([
  a.from('mika_action_proposals').select('status,result').eq('id',env.MIKA_TEST_PROPOSAL_ID).single(),
  a.from('mika_action_audit').select('id,event_type').eq('proposal_id',env.MIKA_TEST_PROPOSAL_ID).eq('event_type','succeeded'),
  a.from('tasks').select('id').eq('id',taskId),
  a.from('tasks').select('id', { count: 'exact', head: true }).eq('plan_id',env.MIKA_TEST_PLAN_ID)
   .eq('user_id',identity.user.id).eq('title',before.payload.title)
 ]);
 for (const error of [pErr,aErr,tErr,countErr]) if (error) throw error;
 assert.equal(proposal.status,'executed');
 assert.equal(proposal.result.task_id,taskId);
 assert.equal(audit.length,1,'Exactly one succeeded audit event');
 assert.equal(tasks.length,1,'Executed task must exist');
 assert.equal(matchingTasks,1,'Exactly one matching synthetic task must exist after concurrent calls');
 console.log(JSON.stringify({outcome:'PASS',duration_ms:Date.now()-started,statuses:results.map(x=>x.execution_status),task_id:taskId,audit_count:audit.length,task_count:matchingTasks,concurrent_claims:CONCURRENT_CLAIMS}));
})().catch(e=>{ console.error('MIKA concurrency staging test FAILED:',e.message);process.exitCode=1;});
