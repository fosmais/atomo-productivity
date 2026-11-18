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
  assert.match(src, /saved: false/);
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


test("MYRA balance API requires authentication and MFA and does not cache rewards", () => {
  const api = read("src/app/api/journeys/myra/route.ts");
  assert.match(api, /supabase\.auth\.getUser\(\)/);
  assert.match(api, /status: 401/);
  assert.match(api, /getAuthenticatorAssuranceLevel\(\)/);
  assert.match(api, /nextLevel === "aal2"/);
  assert.match(api, /status: 403/);
  assert.match(api, /\.eq\("owner_id", user\.id\)/);
  assert.match(api, /\.range\(offset, offset \+ 999\)/);
  assert.match(api, /balance \+= entries\.reduce/);
  assert.match(api, /"Cache-Control": "private, no-store"/);
});


test("database completion trigger validates saved MIKA assessment under row lock", () => {
  const sql = read("supabase/migrations/20261116000100_guard_assessed_mission_completion.sql");
  assert.match(sql, /before insert or update of status on public\.myryra_journey_missions/);
  assert.match(sql, /from public\.myryra_journey_learning_progress[\s\S]*?for update/);
  assert.match(sql, /assessment_passed is distinct from true/);
  assert.match(sql, /assessment_score < required_score/);
  assert.match(sql, /mika_teacher_sessions/);
  assert.match(sql, /myryra_journey_mission_assessment_policy/);
  assert.match(sql, /new\.title ~\*/);
  assert.match(sql, /raise exception 'Missao educacional exige avaliacao aprovada e persistida\.'/);
});

test("database assessment conflict returns actionable HTTP 409 without caching", () => {
  const src = read("src/app/api/journeys/[journeyId]/missions/[missionId]/route.ts");
  assert.match(src, /updateError\?\.code === "23514" && status === "completed"/);
  assert.match(src, /code: "MISSION_ASSESSMENT_REQUIRED"/);
  assert.match(src, /status: 409, headers: \{ "Cache-Control": "private, no-store" \}/);
  assert.match(src, /if \(updateError\) return NextResponse\.json\(\{ error: "Não foi possível atualizar a missão\." \}, \{ status: 500 \}\)/);
});

test("MIKA assessment persistence failure returns HTTP 503 instead of false success", () => {
  const src = read("src/app/api/journeys/feedback/route.ts");
  assert.match(src, /if \(saveError\) \{/);
  assert.match(src, /saved: false \}, \{ status: 503, headers: \{ "Cache-Control": "private, no-store" \} \}/);
  assert.doesNotMatch(src, /return NextResponse\.json\(\{ feedback, saved: false \}/);
});

test("saving a Journey draft uses compare-and-set and rejects stale sessions", () => {
  const src = read("src/app/api/journeys/learning/route.ts");
  assert.match(src, /\.eq\("answer", previous\.answer\)\.eq\("updated_at", previous\.updated_at\)\.select\("mission_id"\)/);
  assert.match(src, /if \(!updated\?\.length\) return NextResponse\.json\(\{ error: "A resposta foi alterada em outra sessão/);
  assert.match(src, /if \(error\?\.code === "23505"\) return NextResponse\.json/);
  assert.match(src, /assessment_score: null, assessment_passed: null/);
  assert.doesNotMatch(src, /\.upsert\(\{/);
});

test("MIKA grading cannot save against a superseded draft revision", () => {
  const src = read("src/app/api/journeys/feedback/route.ts");
  assert.match(src, /\.select\("answer,feedback,assessment_attempts,updated_at"\)/);
  assert.match(src, /\.eq\("answer", priorProgress!\.answer\)\s*\.eq\("updated_at", priorProgress!\.updated_at\)/);
  assert.match(src, /\.eq\("assessment_attempts", priorProgress\?\.assessment_attempts \?\? 0\)/);
});

test("MVP2 preview admin client fails closed against production Supabase", () => {
  const src = read("src/lib/supabase/admin.ts");
  assert.match(src, /process\.env\.VERCEL_ENV === "preview"/);
  assert.match(src, /process\.env\.VERCEL_GIT_COMMIT_REF === "feat\/mvp2-professora-journey-myra-26"/);
  assert.match(src, /xanavauqzsrgvdfhcrsm\.supabase\.co/);
  assert.match(src, /throw new Error\("Preview MVP2 não pode usar Supabase fora da homologação\."\)/);
  assert.match(src, /if \(!supabaseUrl \|\| !secretKey\)/);
});

test("versioned exercises are server-issued and owner-readable only", () => {
  const src = read("supabase/migrations/20261117000100_journey_assigned_exercises_foundation.sql");
  assert.match(src, /unique \(mission_id, version\)/);
  assert.match(src, /enable row level security/);
  assert.match(src, /revoke all on public\.myryra_journey_assigned_exercises from public, anon, authenticated/);
  assert.match(src, /grant select on public\.myryra_journey_assigned_exercises to authenticated/);
  assert.match(src, /for select to authenticated/);
  assert.match(src, /owner_id = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(src, /grant (?:insert|update|delete|all) on public\.myryra_journey_assigned_exercises to authenticated/i);
});

test("MIKA grading rejects forged prompts for assigned server exercises", () => {
  const src = read("src/app/api/journeys/feedback/route.ts");
  assert.match(src, /from\("myryra_journey_assigned_exercises"\)/);
  assert.match(src, /\.eq\("mission_id", missionId\)\.eq\("owner_id", user\.id\)/);
  assert.match(src, /\.order\("version", \{ ascending: false \}\)\.limit\(1\)\.maybeSingle\(\)/);
  assert.match(src, /assigned\.exercise !== exercise\.trim\(\)/);
  assert.match(src, /assigned\.session_id && assigned\.session_id !== \(sessionId \?\? null\)/);
  assert.match(src, /exercise: assigned\?\.exercise \?\? exercise\.trim\(\)/);
  assert.match(src, /Exercício oficial indisponível/);
});

test("graded exercise evidence is saved and cleared on draft edits", () => {
  const grading = read("src/app/api/journeys/feedback/route.ts");
  const learning = read("src/app/api/journeys/learning/route.ts");
  const migration = read("supabase/migrations/20261117000200_learning_assessed_exercise_reference.sql");
  assert.match(grading, /assessed_exercise_id: assessedExerciseId/);
  assert.match(grading, /const assessedExerciseId = assigned\.id/);
  assert.match(learning, /assessed_exercise_id: null/);
  assert.match(migration, /add column if not exists assessed_exercise_id uuid/);
  assert.match(migration, /references public\.myryra_journey_assigned_exercises\(id\)/);
});

test("mission completion rejects stale server-assigned exercise grades", () => {
  const sql = read("supabase/migrations/20261117000300_guard_current_assessed_exercise.sql");
  assert.match(sql, /create or replace function public\.myryra_guard_assessed_mission_completion/);
  assert.match(sql, /exists \(select 1 from public\.myryra_journey_assigned_exercises ae/);
  assert.match(sql, /assessed_exercise_id/);
  assert.match(sql, /order by ae\.version desc limit 1/);
  assert.match(sql, /evidence\.assessed_exercise_id is distinct from current_exercise/);
  assert.match(sql, /errcode = '23514'/);
});

test("MIKA canonical lesson prompts are shared between Journey UI and grading API", () => {
  const topics = read("src/lib/journey/lesson-topics.ts");
  const ui = read("src/app/journey/journey-trail.tsx");
  const grading = read("src/app/api/journeys/feedback/route.ts");
  assert.match(topics, /export const lessonTopics = \[/);
  assert.match(topics, /export function lessonFor\(title: string\)/);
  assert.match(ui, /import \{ lessonFor \} from "@\/lib\/journey\/lesson-topics"/);
  assert.match(grading, /import \{ lessonFor \} from "@\/lib\/journey\/lesson-topics"/);
  assert.match(grading, /const canonicalLesson = lessonFor\(mission\.title\)/);
  assert.match(grading, /exercise\.trim\(\) !== canonicalLesson\.exercise/);
  assert.match(grading, /Exercício divergente da aula oficial/);
});

test("MIKA rechecks the latest assigned exercise after AI grading", () => {
  const grading = read("src/app/api/journeys/feedback/route.ts");
  assert.match(grading, /const \{ data: latestAssignment, error: latestAssignmentError \}/);
  assert.match(grading, /if \(\(latestAssignment\?\.id \?\? null\) !== assessedExerciseId\)/);
  assert.match(grading, /O exercício mudou durante a avaliação/);
  assert.ok(grading.indexOf("const { data: latestAssignment") < grading.indexOf(".update({ feedback, assessed_exercise_id: assessedExerciseId"));
});

test("grading never trusts unassigned exercises and issues canonical templates server-side", () => {
  const grading = read("src/app/api/journeys/feedback/route.ts");
  assert.match(grading, /if \(!assigned && canonicalLesson\)/);
  assert.match(grading, /\.insert\(\{ mission_id: missionId, owner_id: user\.id, version: 1, exercise: canonicalLesson\.exercise \}\)/);
  assert.match(grading, /issueError\.code !== "23505"/);
  assert.match(grading, /if \(!assigned\)\s*return NextResponse\.json/);
  assert.match(grading, /const assessedExerciseId = assigned\.id/);
});

test("versioned server assignments can supersede static lesson prompts", () => {
  const grading = read("src/app/api/journeys/feedback/route.ts");
  assert.match(grading, /if \(!assigned && canonicalLesson && exercise\.trim\(\) !== canonicalLesson\.exercise\)/);
  assert.match(grading, /if \(assigned\.exercise !== exercise\.trim\(\)/);
  const staticCheck = grading.indexOf("if (!assigned && canonicalLesson && exercise.trim()");
  const assignmentLookup = grading.indexOf("let { data: assigned, error: assignedError }");
  assert.ok(assignmentLookup >= 0 && staticCheck > assignmentLookup);
});

test("database rejects cross-owner and mutable official exercise assignments", () => {
  const sql = read("supabase/migrations/20261117000400_validate_assigned_exercise_ownership.sql");
  assert.match(sql, /actual_owner is distinct from new\.owner_id/);
  assert.match(sql, /s\.mission_id = new\.mission_id and s\.journey_id = actual_journey/);
  assert.match(sql, /if tg_op = 'UPDATE' then/);
  assert.match(sql, /before insert or update on public\.myryra_journey_assigned_exercises/);
});

test("Journey displays the latest owner-scoped official exercise before grading", () => {
  const route = read("src/app/api/journeys/exercise/route.ts");
  const ui = read("src/app/journey/journey-trail.tsx");
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /\.eq\("owner_id", user\.id\)/);
  assert.match(route, /\.eq\("journey_id", journeyId\)/);
  assert.match(route, /\.order\("version", \{ ascending: false \}\)/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(ui, /async function openOfficialLesson\(mission: Mission\)/);
  assert.match(ui, /fetch\("\/api\/journeys\/exercise", \{ method: "POST"/);
  assert.match(ui, /const exercise = officialExercises\[mission\.id\]/);
  assert.match(ui, /!officialExercises\[m\.id\]/);
});

test("Journey discards stale official exercise responses on navigation", () => {
  const ui = read("src/app/journey/journey-trail.tsx");
  assert.match(ui, /const officialExerciseRequest = useRef\(0\)/);
  assert.match(ui, /const requestId = \+\+officialExerciseRequest\.current/);
  assert.match(ui, /if \(requestId !== officialExerciseRequest\.current\) return/);
  assert.match(ui, /if \(requestId === officialExerciseRequest\.current\)/);
  assert.match(ui, /\+\+officialExerciseRequest\.current;\s*setOpenLesson\(null\);\s*setOfficialExercises\(\{\}\)/);
});

test("closing a lesson invalidates its pending official exercise request", () => {
  const ui = read("src/app/journey/journey-trail.tsx");
  assert.match(ui, /if \(openLesson === mission\.id\) \{\s*\+\+officialExerciseRequest\.current;\s*setExerciseLoading\(null\);\s*setOpenLesson\(null\);/);
});

test("MIKA issues the canonical exercise before the learner answers", () => {
  const route = read("src/app/api/journeys/exercise/route.ts");
  const ui = read("src/app/journey/journey-trail.tsx");
  assert.match(route, /export async function POST\(request: Request\)/);
  assert.match(route, /const lesson = lessonFor\(mission\.title\)/);
  assert.match(route, /exercise: lesson\.exercise/);
  assert.match(route, /insertError\.code !== "23505"/);
  assert.match(route, /hasCurrentLegalAcceptance\(user\.id\)/);
  assert.match(route, /getAuthenticatorAssuranceLevel\(\)/);
  assert.match(ui, /const exercise = data\.assignment\?\.exercise;/);
  assert.doesNotMatch(ui, /data\.assignment\?\.exercise \?\? lessonFor/);
});
