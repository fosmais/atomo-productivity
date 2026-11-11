const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function source(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}
const readiness = source("src/app/api/privacy/readiness/route.ts");
const acceptance = source("src/app/api/privacy/accept/route.ts");
const page = source("src/app/privacy/accept/page.tsx");
const dashboard = source("src/app/dashboard/page.tsx");

test("legal readiness requires authentication and current published versions of both documents", () => {
  assert.match(readiness, /auth\.getUser\(\)/);
  assert.match(readiness, /"terms", "privacy_notice"/);
  assert.match(readiness, /\.eq\("status", "published"\)/);
  assert.match(readiness, /\.lte\("published_at", now\)/);
  assert.match(readiness, /\.lte\("effective_at", now\)/);
  assert.match(readiness, /documents\.every\(\(document\) => document\.published && document\.accepted\)/);
  assert.match(readiness, /agentExecutionEnabled: false/);
});

test("legal acceptance requires explicit affirmative user action and does not trust a user id from request", () => {
  assert.match(acceptance, /auth\.getUser\(\)/);
  assert.match(acceptance, /getAuthenticatorAssuranceLevel\(\)/);
  assert.match(acceptance, /data\.accepted !== true/);
  assert.match(acceptance, /requestId/);
  assert.match(acceptance, /user_id: auth\.user\.id/);
  assert.match(acceptance, /\.eq\("status", "published"\)/);
  assert.match(acceptance, /\.lte\("published_at", now\)/);
  assert.match(acceptance, /\.lte\("effective_at", now\)/);
});

test("acceptance UI is opt-in and separates each document", () => {
  assert.match(page, /type="checkbox"/);
  assert.match(page, /checked=\{Boolean\(selected\[document\.type\]\)\}/);
  assert.match(page, /documentVersionId: document\.documentVersionId/);
  assert.match(page, /accepted: true/);
  assert.match(page, /Permissões opcionais da MIKA serão solicitadas separadamente/);
});

test("dashboard legal gate stays off by default and sends unaccepted users to the consent page", () => {
  assert.match(dashboard, /process\.env\.MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true"/);
  assert.match(dashboard, /redirect\("\/privacy\/accept"\)/);
  assert.match(dashboard, /\.eq\("user_id", user\.id\)/);
});

test("MIKA event confirmation enforces legal readiness when rollout is enabled", () => {
  const proposal = source("src/app/api/myka/proposal/route.ts");
  const guard = source("src/lib/privacy/legal-acceptance.ts");
  assert.match(proposal, /MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true"/);
  assert.match(proposal, /hasCurrentLegalAcceptance\(auth\.user\.id\)/);
  assert.match(proposal, /LEGAL_ACCEPTANCE_REQUIRED/);
  assert.match(guard, /"terms", "privacy_notice"/);
  assert.match(guard, /\.eq\("action", "accepted"\)/);
  assert.match(guard, /return false/);
});

test("legal acceptance rejects stale published versions and refreshes latest version deterministically", () => {
  assert.match(acceptance, /latest\.id !== document\.id/);
  assert.match(acceptance, /Uma nova versão foi publicada/);
  assert.match(acceptance, /\.order\("published_at", \{ ascending: false \}\)/);
  assert.match(readiness, /\.order\("published_at", \{ ascending: false \}\)/);
  assert.match(dashboard, /\.order\("published_at", \{ ascending: false \}\)/);
});

test("consent submission stays disabled when either legal document is missing", () => {
  assert.match(page, /state\.documents\.length !== 2/);
  assert.match(page, /Os documentos legais ainda não estão disponíveis/);
  assert.match(page, /!document\.published \|\| !document\.publicUrl/);
});

test("previously accepted document does not block completing the remaining acceptance", () => {
  assert.match(page, /!document\.accepted && \(!document\.publicUrl/);
  assert.match(page, /const pending = state\.documents\.filter\(\(document\) => !document\.accepted\)/);
});

test("consent validates HTTPS document links and provides retry after readiness failure", () => {
  assert.match(page, /pending\.some\(\(document\) =>/);
  assert.match(page, /!\/\^https:/);
  assert.match(page, /Tentar novamente/);
  assert.match(page, /void refresh\(\)\.catch/);
});

test("Journey confirmation and replan mutations enforce legal acceptance on rollout", () => {
  for (const route of [
    "src/app/api/journeys/confirm/route.ts",
    "src/app/api/journeys/[journeyId]/replan-apply/route.ts",
  ]) {
    const code = source(route);
    assert.match(code, /MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true"/);
    assert.match(code, /hasCurrentLegalAcceptance\(user\.id\)/);
    assert.match(code, /LEGAL_ACCEPTANCE_REQUIRED/);
  }
});


test("MIKA action proposals and authorizations require current legal acceptance when enabled", () => {
  const code = source("src/app/api/mika/actions/route.ts");
  const post = code.split("export async function POST")[1].split("export async function PATCH")[0];
  const patch = code.split("export async function PATCH")[1];
  for (const handler of [post, patch]) {
    assert.match(handler, /MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true"/);
    assert.match(handler, /hasCurrentLegalAcceptance\(user\.id\)/);
    assert.match(handler, /LEGAL_ACCEPTANCE_REQUIRED/);
  }
  assert.match(patch, /if \(decision === "authorize"\)/);
  assert.match(patch, /decision === "authorize" \? "authorized" : "cancelled"/);
});


test("Journey mission completion gates new MYRA awards without blocking undo", () => {
  const code = source("src/app/api/journeys/[journeyId]/missions/[missionId]/route.ts");
  assert.match(code, /status === "completed" &&\s*process\.env\.MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true"/);
  assert.match(code, /hasCurrentLegalAcceptance\(user\.id\)/);
  assert.match(code, /LEGAL_ACCEPTANCE_REQUIRED/);
  assert.match(code, /status === "completed" \? new Date\(\)\.toISOString\(\) : null/);
});


test("Journey achievement creation is gated while viewing and deleting memories remain available", () => {
  const create = source("src/app/api/journeys/[journeyId]/achievements/route.ts");
  const post = create.split("export async function POST")[1];
  const get = create.split("export async function GET")[1].split("export async function POST")[0];
  const deletion = source("src/app/api/journeys/[journeyId]/achievements/[achievementId]/route.ts");
  assert.match(post, /MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true"/);
  assert.match(post, /hasCurrentLegalAcceptance\(user\.id\)/);
  assert.match(post, /LEGAL_ACCEPTANCE_REQUIRED/);
  assert.doesNotMatch(get, /LEGAL_ACCEPTANCE_REQUIRED/);
  assert.doesNotMatch(deletion, /LEGAL_ACCEPTANCE_REQUIRED/);
});


test("Journey edit and resume require legal acceptance while pause and archive remain accessible", () => {
  const code = source("src/app/api/journeys/[journeyId]/route.ts");
  const mutation = code.split("async function changeJourney")[1];
  assert.match(mutation, /!archive && updates\.status !== "paused"/);
  assert.match(mutation, /MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true"/);
  assert.match(mutation, /hasCurrentLegalAcceptance\(user\.id\)/);
  assert.match(mutation, /LEGAL_ACCEPTANCE_REQUIRED/);
  assert.match(mutation, /export async function DELETE/);
});


test("Journey learning and review writes enforce legal acceptance without blocking history reads", () => {
  for (const route of [
    "src/app/api/journeys/learning/route.ts",
    "src/app/api/journeys/review-steps/route.ts",
  ]) {
    const code = source(route);
    const get = code.split("export async function GET")[1].split("export async function PUT")[0];
    const put = code.split("export async function PUT")[1];
    assert.match(put, /MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true"/);
    assert.match(put, /hasCurrentLegalAcceptance\(user\.id\)/);
    assert.match(put, /LEGAL_ACCEPTANCE_REQUIRED/);
    assert.doesNotMatch(get, /LEGAL_ACCEPTANCE_REQUIRED/);
  }
});


test("MIKA learning assessment requires current acceptance before calling OpenAI", () => {
  const code = source("src/app/api/journeys/feedback/route.ts");
  assert.match(code, /MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true"/);
  assert.match(code, /hasCurrentLegalAcceptance\(user\.id\)/);
  assert.match(code, /LEGAL_ACCEPTANCE_REQUIRED/);
  assert.ok(code.indexOf("LEGAL_ACCEPTANCE_REQUIRED") < code.indexOf("client.responses.create("));
});


test("MIKA Concierge authorization is owner-scoped and never claims external execution", () => {
  const code = source("src/app/api/mika/actions/route.ts");
  const patch = code.split("export async function PATCH")[1];
  assert.match(patch, /\.eq\("id", actionId\)\.eq\("user_id", user\.id\)\.eq\("status", "awaiting_authorization"\)/);
  assert.match(patch, /decision === "authorize" \? "authorized" : "cancelled"/);
  assert.match(patch, /executed: false/);
  assert.doesNotMatch(patch, /status:\s*"executed"/);
});


test("MIKA Concierge proposal validates event ownership and never calls a provider", () => {
  const code = source("src/app/api/mika/actions/route.ts");
  const post = code.split("export async function POST")[1].split("export async function PATCH")[0];
  assert.match(post, /\.from\("events"\)\.select\("id"\)\.eq\("id", eventId\)\.eq\("user_id", user\.id\)/);
  assert.match(post, /status: "awaiting_authorization"/);
  assert.doesNotMatch(post, /status:\s*"(?:authorized|executed|completed)"/);
});

test("MIKA Concierge cancellation stays available without new legal acceptance", () => {
  const patch = source("src/app/api/mika/actions/route.ts").split("export async function PATCH")[1];
  const gate = patch.split("const admin = createSupabaseAdmin()")[0];
  assert.match(gate, /if \(decision === "authorize"\)/);
  assert.match(gate, /hasCurrentLegalAcceptance\(user\.id\)/);
  assert.match(patch, /decision === "authorize" \? "authorized" : "cancelled"/);
});


test("MIKA proposal and authorization requests reject oversized JSON before processing", () => {
  const code = source("src/app/api/mika/actions/route.ts");
  const post = code.split("export async function POST")[1].split("export async function PATCH")[0];
  const patch = code.split("export async function PATCH")[1];
  for (const handler of [post, patch]) {
    assert.match(handler, /new TextEncoder\(\)\.encode\(raw\)\.length > 8192/);
    assert.match(handler, /status: 413/);
    assert.ok(handler.indexOf("status: 413") < handler.indexOf("await authenticate()"));
  }
});


test("MIKA task confirmation preflights legal readiness on flagged clients", () => {
  const code = source("src/app/dashboard/task-confirmation.tsx");
  const confirm = code.split("async function handleConfirm")[1].split("async function handleCancel")[0];
  assert.match(confirm, /NEXT_PUBLIC_MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true"/);
  assert.match(confirm, /fetch\("\/api\/privacy\/readiness"/);
  assert.match(confirm, /readiness\.ready !== true/);
  assert.ok(confirm.indexOf("readiness.ready !== true") < confirm.indexOf("myka_confirm_task_item"));
  assert.ok(confirm.indexOf("readiness.ready !== true") < confirm.indexOf('saveCloudPlan("Tarefas do Concierge"'));
});


test("AI task generation requires current legal acceptance before sending user text to provider", () => {
  const code = source("src/app/api/tasks/route.ts");
  assert.match(code, /MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true"/);
  assert.match(code, /hasCurrentLegalAcceptance\(user\.id\)/);
  assert.match(code, /LEGAL_ACCEPTANCE_REQUIRED/);
  assert.ok(code.indexOf("LEGAL_ACCEPTANCE_REQUIRED") < code.indexOf("client.responses.create("));
});
