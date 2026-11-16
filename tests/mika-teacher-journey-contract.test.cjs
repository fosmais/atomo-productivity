const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (relative) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

test("teacher session creation validates mission ownership and keeps mission optional", () => {
  const src = read("src/app/api/mika/lessons/sessions/route.ts");
  assert.match(src, /body\.missionId !== undefined/);
  assert.match(src, /\.eq\("journey_id", journey\.id\)/);
  assert.match(src, /mission_id: body\.missionId/);
});

test("MIKA feedback rejects sessions not linked to the assessed mission", () => {
  const src = read("src/app/api/journeys/feedback/route.ts");
  assert.match(src, /\.eq\("owner_id", user\.id\)/);
  assert.match(src, /\.eq\("journey_id", journeyId\)\.eq\("mission_id", missionId\)/);
  assert.match(src, /Aula não vinculada a esta missão/);
});

test("mission completion preserves legacy learning gate and checks explicit policy", () => {
  const src = read("src/app/api/journeys/[journeyId]/missions/[missionId]/route.ts");
  assert.match(src, /educationalMission\.test\(missionDetails\.title\) \|\| policy\?\.requires_assessment === true/);
  assert.match(src, /learning\.assessment_passed !== true/);
  assert.match(src, /learning\.assessment_score < minimumScore/);
});

test("database rejects cross-owner links and denies client policy writes", () => {
  const sql = read("supabase/migrations/20261114000100_mika_teacher_mission_link.sql");
  assert.match(sql, /mika_teacher_validate_mission_link/);
  assert.match(sql, /myryra_validate_assessment_policy_owner/);
  assert.match(sql, /revoke all on public\.myryra_journey_mission_assessment_policy from public, anon, authenticated/);
  assert.match(sql, /grant select on public\.myryra_journey_mission_assessment_policy to authenticated/);
});

test("teacher session create and history responses expose linked mission id", () => {
  const src = read("src/app/api/mika/lessons/sessions/route.ts");
  const selects = [...src.matchAll(/\.select\("([^"]+)"\)/g)].map((match) => match[1]);
  const sessionSelects = selects.filter((columns) => columns.includes("scheduled_at") && columns.includes("topic"));
  assert.equal(sessionSelects.length, 2, "both GET and POST must select session fields");
  for (const columns of sessionSelects) {
    assert.ok(columns.split(",").includes("mission_id"), "session response must include mission_id");
  }
});

test("migration trigger bodies have balanced PostgreSQL dollar quotes", () => {
  const sql = read("supabase/migrations/20261114000100_mika_teacher_mission_link.sql");
  assert.equal((sql.match(/\$\$/g) ?? []).length % 2, 0, "unbalanced PL/pgSQL dollar quotes");
  assert.ok(sql.includes("as $$"), "trigger body must use a valid dollar-quoted delimiter");
  assert.ok(sql.includes("end;\n$$;"), "trigger body must close its dollar quote");
  assert.match(sql, /minimum_score between 70 and 100/);
});

test("migration preflight block terminates before the schema changes", () => {
  const sql = read("supabase/migrations/20261114000100_mika_teacher_mission_link.sql");
  assert.ok(sql.includes("do $preflight$\nbegin"), "preflight must start with a named dollar quote");
  assert.ok(sql.includes("end;\n$preflight$;"), "preflight must close the PL/pgSQL block correctly");
  assert.ok(sql.indexOf("$preflight$;") < sql.indexOf("alter table public.mika_teacher_sessions"), "preflight must run before DDL");
});


test("MYRA migration preserves unique reward and owner-only access", () => {
  const sql = read("supabase/migrations/20261114000200_restore_myra_ledger.sql");
  assert.match(sql, /mission_id uuid not null unique references public\.myryra_journey_missions/);
  assert.match(sql, /amount integer not null default 10 check \(amount = 10\)/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /grant select on public\.myryra_journey_myra_ledger to authenticated/);
  assert.match(sql, /revoke all on public\.myryra_journey_myra_ledger from public, anon, authenticated/);
  assert.match(sql, /on conflict \(mission_id\) do nothing/);
  assert.match(sql, /revoke all on function public\.myryra_credit_completed_mission\(\) from public, anon, authenticated/);
});

test("assessment requires a saved answer, feedback, passing flag and minimum score", () => {
  const src = read("src/app/api/journeys/[journeyId]/missions/[missionId]/route.ts");
  assert.match(src, /learning\?\.answer\?\.trim\(\)/);
  assert.match(src, /learning\?\.feedback\?\.trim\(\)/);
  assert.match(src, /learning\.assessment_passed !== true/);
  assert.match(src, /learning\.assessment_score < minimumScore/);
  assert.match(src, /if \(policyError\) return NextResponse\.json/);
});


test("client cannot update mission status or forge MIKA assessment", () => {
  const sql = read("supabase/migrations/20261114000300_protect_journey_assessments.sql");
  assert.match(sql, /revoke update on public\.myryra_journey_missions from public, anon, authenticated/);
  assert.match(sql, /revoke insert, update, delete, truncate on public\.myryra_journey_learning_progress from public, anon, authenticated/);
  const route = read("src/app/api/journeys/[journeyId]/missions/[missionId]/route.ts");
  assert.match(route, /createSupabaseAdmin\(\)\.from\("myryra_journey_missions"\)/);
});

test("client cannot create an already completed mission to trigger MYRA", () => {
  const sql = read("supabase/migrations/20261114000400_guard_completed_mission_insert.sql");
  assert.match(sql, /new\.status = 'completed'/);
  assert.match(sql, /current_user in \('authenticated', 'anon'\)/);
  assert.match(sql, /before insert on public\.myryra_journey_missions/);
});


test("MIKA-linked missions require assessment regardless of mission title", () => {
  const src = read("src/app/api/journeys/[journeyId]/missions/[missionId]/route.ts");
  assert.match(src, /\.from\("mika_teacher_sessions"\)/);
  assert.match(src, /\.eq\("mission_id", missionId\)\.eq\("journey_id", journeyId\)/);
  assert.match(src, /if \(linkedLessonError\) return NextResponse\.json/);
  assert.match(src, /policy\?\.requires_assessment === true \|\| !!linkedLesson/);
});
test("client cannot directly mutate assessment evidence or mission completion", () => {
  const sql = read("supabase/migrations/20261114000300_protect_journey_assessments.sql");
  assert.match(sql, /revoke update on public\.myryra_journey_missions from public, anon, authenticated/);
  assert.match(sql, /revoke insert, update, delete, truncate on public\.myryra_journey_learning_progress from public, anon, authenticated/);
  const guard = read("supabase/migrations/20261114000400_guard_completed_mission_insert.sql");
  assert.match(guard, /new\.status = 'completed'/);
  assert.match(guard, /current_user in \('authenticated', 'anon'\)/);
});


test("MIKA feedback rejects changed drafts and conflicting concurrent assessments", () => {
  const src = read("src/app/api/journeys/feedback/route.ts");
  assert.match(src, /priorProgress\?\.answer\?\.trim\(\) !== answer\.trim\(\)/);
  assert.match(src, /currentProgress\?\.answer !== priorProgress\?\.answer/);
  assert.match(src, /\.eq\("answer", priorProgress!\.answer\)/);
  assert.match(src, /\.eq\("assessment_attempts", priorProgress\?\.assessment_attempts \?\? 0\)/);
  assert.match(src, /if \(!savedRows\?\.length\)/);
});

test("MIKA feedback enforces scoring consistency and only reports saved success", () => {
  const src = read("src/app/api/journeys/feedback/route.ts");
  assert.match(src, /assessment\.score < 0 \|\| assessment\.score > 100/);
  assert.match(src, /assessment\.passed !== \(assessment\.score >= 70\)/);
  assert.match(src, /feedback, saved: false/);
  assert.match(src, /feedback, saved: true, score: assessment\.score, passed: assessment\.passed/);
});


test("mission completion uses privileged conditional write only after ownership and assessment gates", () => {
  const src = read("src/app/api/journeys/[journeyId]/missions/[missionId]/route.ts");
  assert.match(src, /\.eq\("owner_id", user\.id\)\.maybeSingle\(\)/);
  assert.match(src, /learning\.assessment_passed !== true/);
  assert.match(src, /learning\.assessment_score < minimumScore/);
  assert.match(src, /createSupabaseAdmin\(\)\.from\("myryra_journey_missions"\)/);
  assert.match(src, /\.eq\("id", missionId\)\.eq\("journey_id", journeyId\)\.eq\("status", existingMission\.status\)/);
  assert.doesNotMatch(src, /await supabase\.from\("myryra_journey_missions"\)\s*\.update\(/);
});


test("MIKA lesson creation requires legal acceptance when gate is enabled", () => {
  const src = read("src/app/api/mika/lessons/sessions/route.ts");
  assert.match(src, /import \{ hasCurrentLegalAcceptance \} from "@\/lib\/privacy\/legal-acceptance"/);
  const post = src.slice(src.indexOf("export async function POST("));
  assert.match(post, /MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true"/);
  assert.match(post, /hasCurrentLegalAcceptance\(user\.id\)/);
  assert.match(post, /code: "LEGAL_ACCEPTANCE_REQUIRED"/);
  assert.match(post, /status: 403/);
  assert.ok(post.indexOf("hasCurrentLegalAcceptance(user.id)") < post.indexOf('.from("mika_teacher_sessions")'), "legal gate must precede session insert");
});


test("MYRA ledger retains immutable source after mission or journey deletion", () => {
  const sql = read("supabase/migrations/20261115000200_preserve_myra_history.sql");
  assert.match(sql, /source_mission_id uuid/);
  assert.match(sql, /source_mission_id set not null/);
  assert.match(sql, /unique \(source_mission_id\)/);
  assert.match(sql, /foreign key \(mission_id\)[\s\S]*?on delete set null/);
  assert.match(sql, /foreign key \(journey_id\)[\s\S]*?on delete set null/);
  assert.match(sql, /on conflict \(source_mission_id\) do nothing/);
  const api = read("src/app/api/journeys/myra/route.ts");
  assert.match(api, /source_mission_id: string/);
  assert.match(api, /mission_id: string \| null/);
  assert.match(api, /journey_id: string \| null/);
  assert.match(api, /\.select\("amount,created_at,source_mission_id,mission_id,journey_id"\)/);
});

test("MYRA account deletion and owner RLS remain in force", () => {
  const migration = read("supabase/migrations/20261115000200_preserve_myra_history.sql");
  assert.doesNotMatch(migration, /drop constraint myryra_journey_myra_ledger_owner_id_fkey/);
  const original = read("supabase/migrations/20261114000200_restore_myra_ledger.sql");
  assert.match(original, /owner_id uuid not null references auth\.users\(id\) on delete cascade/i);
  assert.match(original, /auth\.uid\(\).*owner_id|owner_id.*auth\.uid\(\)/i);
});
