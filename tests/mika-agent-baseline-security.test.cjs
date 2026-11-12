const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const baseline = fs.readFileSync(path.join(__dirname, '../docs/sql/mika-agent-baseline-schema-review.sql'), 'utf8');
const executor = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261109120000_mika_execution_approved_plan_compat.sql'), 'utf8');

test('MIKA baseline restricts direct writes and isolates owner reads', () => {
 for (const table of ['mika_action_proposals', 'mika_action_audit']) {
  assert.match(baseline, new RegExp('ALTER TABLE public\\.' + table + ' ENABLE ROW LEVEL SECURITY'));
 }
 assert.match(baseline, /REVOKE ALL ON public\.mika_action_proposals,public\.mika_action_audit FROM PUBLIC,anon,authenticated/);
 assert.match(baseline, /GRANT SELECT ON public\.mika_action_proposals,public\.mika_action_audit TO authenticated/);
 assert.equal((baseline.match(/USING \(\(select auth\.uid\(\)\)=user_id\)/g) || []).length, 2);
 assert.doesNotMatch(baseline, /GRANT (INSERT|UPDATE|DELETE|ALL) ON .* TO authenticated/i);
});

test('MIKA baseline enforces ownership, audit deduplication and idempotency', () => {
 assert.match(baseline, /FOREIGN KEY \(proposal_id,user_id\)/);
 assert.match(baseline, /UNIQUE/);
 assert.match(baseline, /execution_key uuid UNIQUE/);
 assert.match(baseline, /mika_action_audit_proposal_event_once_idx/);
 assert.match(baseline, /expires_at > created_at/);
});

test('MIKA executor locks proposal and disallows anonymous and service-role calls', () => {
 assert.match(executor, /FOR UPDATE|for update/i);
 assert.match(executor, /auth\.uid\(\)/);
 assert.match(executor, /REVOKE ALL ON FUNCTION public\.mika_execute_approved_task\(uuid,uuid\) FROM PUBLIC, anon, service_role/i);
 assert.match(executor, /GRANT EXECUTE ON FUNCTION public\.mika_execute_approved_task\(uuid,uuid\) TO authenticated/i);
});

test('MIKA concurrency harness is staging-only and requires synthetic authenticated fixtures', () => {
 const harness = fs.readFileSync(path.join(__dirname, '../scripts/mika-concurrency-staging.cjs'), 'utf8');
 assert.ok(harness.includes('xanavauqzsrgvdfhcrsm.supabase.co'));
 assert.ok(harness.includes("claims.role !== 'authenticated'"));
 assert.ok(harness.includes('auth.getUser'));
 assert.match(harness, /MIKA-STAGING-TEST/);
 assert.ok(harness.includes('Promise.all'));
 assert.match(harness, /already_executed/);
 assert.match(harness, /Exactly one succeeded audit event/);
 assert.match(harness, /Exactly one task persisted after concurrent calls/);
 assert.doesNotMatch(harness, /service_role_key|SUPABASE_SERVICE_ROLE_KEY/);
});


test('MIKA staging concurrency requires twenty claims and one persisted task', () => {
 const harness = fs.readFileSync(path.join(__dirname, '../scripts/mika-concurrency-staging.cjs'), 'utf8');
 assert.match(harness, /CONCURRENT_CLAIMS = 20/);
 assert.match(harness, /Array\.from\(\{length: CONCURRENT_CLAIMS\}/);
 assert.match(harness, /execution_status==='executed'\)\.length,1/);
 assert.match(harness, /execution_status==='already_executed'\)\.length,CONCURRENT_CLAIMS-1/);
 assert.match(harness, /results\.every\(x=>x\.task_id===taskId\)/);
 assert.match(harness, /Exactly one succeeded audit event/);
 assert.match(harness, /Exactly one task persisted after concurrent calls/);
});


test('MIKA actions API never claims an external action was executed by an approval', () => {
 const route = fs.readFileSync(path.join(__dirname, '../src/app/api/mika/actions/route.ts'), 'utf8');
 const post = route.split('export async function POST')[1].split('export async function PATCH')[0];
 const patch = route.split('export async function PATCH')[1];
 assert.match(post, /status: "awaiting_authorization"/);
 assert.match(patch, /\.eq\("user_id", user\.id\)\.eq\("status", "awaiting_authorization"\)/);
 assert.match(patch, /executed: false/);
 assert.doesNotMatch(patch, /fetch\(|responses\.create\(|\.rpc\(/);
 assert.doesNotMatch(patch, /status: "succeeded"|status: "completed"/);
});


test('MIKA authorization rejects injected fields before changing approval state', () => {
 const route = fs.readFileSync(path.join(__dirname, '../src/app/api/mika/actions/route.ts'), 'utf8');
 const patch = route.split('export async function PATCH')[1];
 assert.match(patch, /Object\.keys\(body\)\.some\(key => !\["actionId", "decision"\]\.includes\(key\)\)/);
 assert.match(patch, /Campos não permitidos na decisão/);
 assert.ok(patch.indexOf('Campos não permitidos na decisão') < patch.indexOf('await authenticate()'));
 assert.match(patch, /executed: false/);
});


test('MIKA proposal creation is rate limited without blocking authorization revocation', () => {
 const route = fs.readFileSync(path.join(__dirname, '../src/app/api/mika/actions/route.ts'), 'utf8');
 const post = route.split('export async function POST')[1].split('export async function PATCH')[0];
 const patch = route.split('export async function PATCH')[1];
 assert.match(post, /checkConciergeRateLimit\(user\.id\)/);
 assert.match(post, /status: 429/);
 assert.match(post, /"Retry-After"/);
 assert.ok(post.indexOf('checkConciergeRateLimit(user.id)') < post.indexOf('.from("mika_agent_actions")'));
 assert.doesNotMatch(patch, /checkConciergeRateLimit/);
 assert.match(patch, /decision === "authorize" \? "authorized" : "cancelled"/);
});


test('MIKA proposal rejects client-supplied ownership and execution metadata', () => {
 const route = fs.readFileSync(path.join(__dirname, '../src/app/api/mika/actions/route.ts'), 'utf8');
 const post = route.split('export async function POST')[1].split('export async function PATCH')[0];
 assert.match(post, /Object\.keys\(body\)\.some\(key => !\["eventId", "service", "actionType", "provider", "proposal"\]\.includes\(key\)\)/);
 assert.match(post, /Campos não permitidos na proposta/);
 assert.ok(post.indexOf('Campos não permitidos na proposta') < post.indexOf('await authenticate()'));
 assert.match(post, /status: "awaiting_authorization"/);
});


test('MIKA proposal action type matches the supported history filter', () => {
 const route = fs.readFileSync(path.join(__dirname, '../src/app/api/mika/actions/route.ts'), 'utf8');
 const get = route.split('export async function GET')[1].split('export async function POST')[0];
 const post = route.split('export async function POST')[1].split('export async function PATCH')[0];
 assert.match(get, /actionType !== "concierge_planning"/);
 assert.match(post, /actionType !== "concierge_planning"/);
 assert.ok(post.indexOf('actionType !== "concierge_planning"') < post.indexOf('await authenticate()'));
});


test('internal task execution uses authenticated transactional RPC and fails closed', () => {
 const route = fs.readFileSync(path.join(__dirname, '../src/app/api/mika/execute-approved-task/route.ts'), 'utf8');
 assert.match(route, /MYRYRA_MIKA_INTERNAL_EXECUTION_ENABLED !== "true"/);
 assert.match(route, /auth\.getUser\(\)/);
 assert.match(route, /getAuthenticatorAssuranceLevel\(\)/);
 assert.match(route, /hasCurrentLegalAcceptance\(auth\.user\.id\)/);
 assert.match(route, /supabase\.rpc\("mika_execute_approved_task"/);
 assert.doesNotMatch(route, /createSupabaseAdmin/);
 assert.ok(route.indexOf('hasCurrentLegalAcceptance(auth.user.id)') < route.indexOf('supabase.rpc("mika_execute_approved_task"'));
 assert.match(route, /already_executed/);
 assert.match(route, /expired/);
});


test('unhomologated MIKA task execution cannot be enabled in Vercel production', () => {
 const route = fs.readFileSync(path.join(__dirname, '../src/app/api/mika/execute-approved-task/route.ts'), 'utf8');
 assert.match(route, /process\.env\.VERCEL_ENV === "production"/);
 assert.ok(route.indexOf('process.env.VERCEL_ENV === "production"') < route.indexOf('MYRYRA_MIKA_INTERNAL_EXECUTION_ENABLED !== "true"'));
 assert.ok(route.indexOf('process.env.VERCEL_ENV === "production"') < route.indexOf('supabase.rpc("mika_execute_approved_task"'));
});


test('MIKA executor title length matches persisted proposal constraints', () => {
 assert.match(baseline, /length\(btrim\(payload->>'title'\)\) BETWEEN 3 AND 160/);
 assert.match(executor, /length\(btrim\(v_title\)\) < 3 or length\(v_title\)>160/);
 assert.doesNotMatch(executor, /length\(btrim\(v_title\)\) < 1 or length\(v_title\)>200/);
});


test('MIKA executor requires a recorded and non-future approval timestamp', () => {
 assert.match(executor, /p\.status <> 'approved' or p\.action_type <> 'create_task' or p\.approved_at is null or p\.approved_at > now\(\)/);
 assert.ok(executor.indexOf("p.approved_at is null") < executor.indexOf("insert into public.tasks("));
});
