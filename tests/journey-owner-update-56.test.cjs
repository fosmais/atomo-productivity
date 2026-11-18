const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/journeys/[journeyId]/route.ts"), "utf8");

test("Journey PATCH and archive writes use a privileged server client after ownership verification", () => {
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /\.eq\("id", journeyId\)\.eq\("owner_id", user\.id\)\.maybeSingle\(\)/);
  assert.match(route, /hasCurrentLegalAcceptance\(user\.id\)/);
  assert.match(route, /createSupabaseAdmin\(\)\.from\("myryra_journeys"\)\.update\(updates\)/);
  assert.match(route, /\.eq\("id", journeyId\)\.eq\("owner_id", user\.id\)/);
  assert.doesNotMatch(route, /await supabase\.from\("myryra_journeys"\)\.update\(updates\)/);
});

test("Journey route limits mutation fields and archive remains a soft delete", () => {
  assert.match(route, /updates\.status = "archived"/);
  assert.match(route, /updates\.status = data\.status/);
  assert.match(route, /updates\.title = data\.title\.trim\(\)/);
  assert.match(route, /updates\.target_date = data\.targetDate/);
  assert.match(route, /export async function DELETE/);
});

const admin = fs.readFileSync(path.join(process.cwd(), "src/lib/supabase/admin.ts"), "utf8");

test("Journey requires MFA and valid identity before any privileged write", () => {
  const authPosition = route.indexOf("supabase.auth.getUser()");
  const mfaPosition = route.indexOf("supabase.auth.mfa.getAuthenticatorAssuranceLevel()", route.indexOf("async function changeJourney"));
  const adminPosition = route.indexOf('createSupabaseAdmin().from("myryra_journeys").update(updates)');
  assert.ok(authPosition >= 0 && mfaPosition >= 0 && adminPosition > mfaPosition);
  assert.match(route, /assurance\.data\.nextLevel === "aal2"/);
  assert.match(route, /assurance\.data\.currentLevel !== "aal2"/);
  assert.match(route, /if \(authError \|\| !user\)/);
});

test("Journey enforces owner filter and only allowed status transitions", () => {
  assert.match(route, /\.eq\("id", journeyId\)\.eq\("owner_id", user\.id\)/);
  assert.match(route, /data\.status !== "active" && data\.status !== "paused"/);
  assert.match(route, /updates\.status === "paused" \? \["active"\]/);
  assert.match(route, /updates\.status === "active" \? \["paused"\]/);
  assert.doesNotMatch(route, /\.delete\(\)/);
});

test("Legal gate preserves pause and archive while restricting edits and resume", () => {
  assert.match(route, /!archive && updates\.status !== "paused"/);
  assert.match(route, /MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED/);
  assert.match(route, /LEGAL_ACCEPTANCE_REQUIRED/);
});

test("Admin client rejects production Supabase URL in the two MVP2 preview branches", () => {
  assert.match(admin, /VERCEL_ENV === "preview"/);
  assert.match(admin, /VERCEL_GIT_COMMIT_REF === "feat\/mvp2-professora-journey-myra-26"/);
  assert.match(admin, /VERCEL_GIT_COMMIT_REF === "fix\/mvp2-journey-owner-update-56"/);
  assert.match(admin, /stagingUrl\.protocol !== "https:"/);
  assert.match(admin, /stagingUrl\.hostname !== "xanavauqzsrgvdfhcrsm\.supabase\.co"/);
  assert.match(admin, /throw new Error\("Preview MVP2 não pode usar Supabase fora da homologação\."\)/);
});


test("Journey pause, resume and archive never delete MYRA history", () => {
  assert.match(route, /if \(archive\)\s*\{\s*updates\.status = "archived"/);
  assert.match(route, /updates\.status === "paused" \? \["active"\]/);
  assert.match(route, /updates\.status === "active" \? \["paused"\]/);
  assert.match(route, /\.update\(updates\)/);
  assert.doesNotMatch(route, /\.delete\s*\(/);
  assert.doesNotMatch(route, /\.from\("myryra_journey_myra_ledger"\)/);
  assert.match(route, /Histórico e MYRAs preservados/);
});


test("Journey rejects unauthenticated mutation and enforces ownership in the write query", () => {
  const change = route.slice(route.indexOf("async function changeJourney"));
  const unauthenticated = change.indexOf('if (authError || !user)');
  const privilegedWrite = change.indexOf('createSupabaseAdmin().from("myryra_journeys").update(updates)');
  const ownerFilter = change.indexOf('.eq("id", journeyId).eq("owner_id", user.id)', privilegedWrite);
  assert.ok(unauthenticated >= 0 && unauthenticated < privilegedWrite);
  assert.ok(ownerFilter > privilegedWrite);
  assert.match(change, /if \(!data\) return NextResponse\.json\(\{ error: "Meta não encontrada ou já excluída\." \}, \{ status: 404 \}\)/);
  assert.match(change, /if \(!uuid\.test\(journeyId\)\).*status: 400/);
});

test("Journey archive cannot be resumed or modified by privileged update", () => {
  const change = route.slice(route.indexOf("async function changeJourney"));
  assert.match(change, /\.in\("status", updates\.status === "paused" \? \["active"\] : updates\.status === "active" \? \["paused"\] : archive \? \["active", "paused", "completed"\]/);
  assert.doesNotMatch(change, /\.delete\s*\(/);
});
