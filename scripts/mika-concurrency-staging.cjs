#!/usr/bin/env node
/**
 * Manual staging-only concurrency check. Requires an approved, unexecuted
 * create_task proposal whose payload.plan_id matches MIKA_TEST_PLAN_ID.
 * Both clients use the same real user's access token but independent HTTP calls.
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
const a = makeClient(), b = makeClient();
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
 assert.match(before.payload.title, /^\\[MIKA-STAGING-TEST\\]/, 'Only explicitly marked synthetic proposals may be executed');
 assert.equal(before.payload.plan_id,env.MIKA_TEST_PLAN_ID);
 const { data: plan, error: planError } = await a.from('plans')
  .select('id,user_id,title').eq('id',env.MIKA_TEST_PLAN_ID).single();
 if (planError) throw planError;
 assert.equal(plan.user_id,identity.user.id,'Plan must belong to the authenticated test user');
 assert.match(plan.title, /^\\[MIKA-STAGING-TEST\\]/, 'Only synthetic test plans may be used');
 const { data: existingAudit, error: auditBeforeError } = await a.from('mika_action_audit')
  .select('id').eq('proposal_id',env.MIKA_TEST_PROPOSAL_ID).eq('event_type','succeeded');
 if (auditBeforeError) throw auditBeforeError;
 assert.equal(existingAudit.length,0,'Test proposal must have no previous success audit');
 const args = { p_proposal_id: env.MIKA_TEST_PROPOSAL_ID, p_plan_id: env.MIKA_TEST_PLAN_ID };
 const started = Date.now();
 const [one,two] = await Promise.all([
  a.rpc('mika_execute_approved_task',args),
  b.rpc('mika_execute_approved_task',args)
 ]);
 if (one.error) throw one.error;
 if (two.error) throw two.error;
 const results = [one.data,two.data].map(x => Array.isArray(x) ? x[0] : x);
 assert.deepEqual(results.map(x=>x.execution_status).sort(),['already_executed','executed']);
 assert.ok(results[0].task_id);
 assert.equal(results[0].task_id,results[1].task_id);
 const [{data:proposal,error:pErr},{data:audit,error:aErr},{data:tasks,error:tErr}] = await Promise.all([
  a.from('mika_action_proposals').select('status,result').eq('id',env.MIKA_TEST_PROPOSAL_ID).single(),
  a.from('mika_action_audit').select('id,event_type').eq('proposal_id',env.MIKA_TEST_PROPOSAL_ID).eq('event_type','succeeded'),
  a.from('tasks').select('id').eq('id',results[0].task_id)
 ]);
 for (const error of [pErr,aErr,tErr]) if (error) throw error;
 assert.equal(proposal.status,'executed');
 assert.equal(proposal.result.task_id,results[0].task_id);
 assert.equal(audit.length,1,'Exactly one succeeded audit event');
 assert.equal(tasks.length,1,'Exactly one task persisted');
 console.log(JSON.stringify({outcome:'PASS',duration_ms:Date.now()-started,statuses:results.map(x=>x.execution_status),task_id:results[0].task_id,audit_count:audit.length,task_count:tasks.length}));
})().catch(e=>{ console.error('MIKA concurrency staging test FAILED:',e.message);process.exitCode=1;});
