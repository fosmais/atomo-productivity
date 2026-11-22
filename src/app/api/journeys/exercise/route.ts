import { educationalLessonFor } from "@/lib/journey/lesson-topics";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { hasCurrentLegalAcceptance } from "@/lib/privacy/legal-acceptance";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const journeyId = url.searchParams.get("journeyId");
  const missionId = url.searchParams.get("missionId");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!journeyId || !uuid.test(journeyId) || !missionId || !uuid.test(missionId))
    return NextResponse.json({ error: "Missão inválida." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  if (process.env.MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true" &&
      !(await hasCurrentLegalAcceptance(user.id)))
    return NextResponse.json({ error: "Aceite dos documentos legais vigentes necessário." }, { status: 403 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  const { data: journey, error: journeyError } = await supabase.from("myryra_journeys")
    .select("id").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (journeyError) return NextResponse.json({ error: "Jornada indisponível." }, { status: 503 });
  if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404 });
  const { data: mission, error: missionError } = await supabase.from("myryra_journey_missions")
    .select("id").eq("id", missionId).eq("journey_id", journeyId).maybeSingle();
  if (missionError) return NextResponse.json({ error: "Missão indisponível." }, { status: 503 });
  if (!mission) return NextResponse.json({ error: "Missão não encontrada." }, { status: 404 });
  const { data: assignment, error: assignmentError } = await supabase
    .from("myryra_journey_assigned_exercises")
    .select("id,version,exercise").eq("owner_id", user.id).eq("mission_id", missionId)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  if (assignmentError) return NextResponse.json({ error: "Exercício indisponível." }, { status: 503 });
  return NextResponse.json({ assignment: assignment ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return NextResponse.json({ error: "Envie um JSON válido." }, { status: 415 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { journeyId, missionId } = body as Record<string, unknown>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof journeyId !== "string" || !uuid.test(journeyId) ||
      typeof missionId !== "string" || !uuid.test(missionId))
    return NextResponse.json({ error: "Missão inválida." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  if (process.env.MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true" &&
      !(await hasCurrentLegalAcceptance(user.id)))
    return NextResponse.json({ error: "Aceite dos documentos legais vigentes necessário." }, { status: 403 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  const { data: journey, error: journeyError } = await supabase.from("myryra_journeys")
    .select("id").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (journeyError) return NextResponse.json({ error: "Jornada indisponível." }, { status: 503 });
  if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404 });
  const { data: mission, error: missionError } = await supabase.from("myryra_journey_missions")
    .select("id,title").eq("id", missionId).eq("journey_id", journeyId).maybeSingle();
  if (missionError) return NextResponse.json({ error: "Missão indisponível." }, { status: 503 });
  if (!mission) return NextResponse.json({ error: "Missão não encontrada." }, { status: 404 });
  const latest = () => supabase.from("myryra_journey_assigned_exercises")
    .select("id,version,exercise").eq("owner_id", user.id).eq("mission_id", missionId)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  let { data: assignment, error: assignmentError } = await latest();
  if (assignmentError) return NextResponse.json({ error: "Exercício indisponível." }, { status: 503 });
  if (!assignment) {
    const lesson = educationalLessonFor(mission.title);
    if (!lesson) return NextResponse.json({ error: "Esta missão ainda não possui exercício oficial." }, { status: 409 });
    const { error: insertError } = await createSupabaseAdmin()
      .from("myryra_journey_assigned_exercises")
      .insert({ mission_id: missionId, owner_id: user.id, version: 1, exercise: lesson.exercise });
    if (insertError && insertError.code !== "23505")
      return NextResponse.json({ error: "Falha ao emitir exercício oficial." }, { status: 503 });
    ({ data: assignment, error: assignmentError } = await latest());
    if (assignmentError || !assignment)
      return NextResponse.json({ error: "Exercício oficial indisponível." }, { status: 503 });
  }
  return NextResponse.json({ assignment }, { headers: { "Cache-Control": "private, no-store" } });
}
