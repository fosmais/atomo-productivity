import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authenticate() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, status: 401 };
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return { supabase, user: null, status: 403 };
  return { supabase, user, status: 200 };
}

export async function GET(request: Request) {
  const journeyId = new URL(request.url).searchParams.get("journeyId");
  if (!journeyId || !uuid.test(journeyId)) return NextResponse.json({ error: "Jornada inválida." }, { status: 400 });
  const { supabase, user, status } = await authenticate();
  if (!user) return NextResponse.json({ error: "Acesso não autorizado." }, { status });
  const { data: journey, error } = await supabase.from("myryra_journeys").select("id").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Erro ao consultar a jornada." }, { status: 500 });
  if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404 });
  const { data: missions, error: missionsError } = await supabase.from("myryra_journey_missions").select("id").eq("journey_id", journeyId).limit(104);
  if (missionsError) return NextResponse.json({ error: "Erro ao consultar missões." }, { status: 500 });
  const ids = (missions ?? []).map(m => m.id);
  if (!ids.length) return NextResponse.json({ entries: [] }, { headers: { "Cache-Control": "private, no-store" } });
  const { data, error: progressError } = await supabase.from("myryra_journey_learning_progress").select("mission_id,answer,feedback").eq("owner_id", user.id).in("mission_id", ids);
  if (progressError) return NextResponse.json({ error: "Histórico de aprendizagem indisponível." }, { status: 503 });
  return NextResponse.json({ entries: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return NextResponse.json({ error: "Envie um JSON válido." }, { status: 415 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { journeyId, missionId, answer } = body as Record<string, unknown>;
  if (typeof journeyId !== "string" || !uuid.test(journeyId) || typeof missionId !== "string" || !uuid.test(missionId) || typeof answer !== "string" || answer.length > 2000)
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { supabase, user, status } = await authenticate();
  if (!user) return NextResponse.json({ error: "Acesso não autorizado." }, { status });
  const { data: journey, error: journeyError } = await supabase.from("myryra_journeys").select("id").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (journeyError) return NextResponse.json({ error: "Erro ao consultar a jornada." }, { status: 500 });
  if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404 });
  const { data: mission, error: missionError } = await supabase.from("myryra_journey_missions").select("id").eq("id", missionId).eq("journey_id", journeyId).maybeSingle();
  if (missionError) return NextResponse.json({ error: "Erro ao consultar a missão." }, { status: 500 });
  if (!mission) return NextResponse.json({ error: "Missão não encontrada." }, { status: 404 });
  const { data: previous, error: readError } = await supabase.from("myryra_journey_learning_progress")
    .select("answer,feedback").eq("mission_id", missionId).eq("owner_id", user.id).maybeSingle();
  if (readError) return NextResponse.json({ error: "Não foi possível consultar a resposta anterior." }, { status: 503 });
  const { error } = await supabase.from("myryra_journey_learning_progress").upsert({
    mission_id: missionId, owner_id: user.id, answer,
    feedback: previous?.answer === answer ? previous.feedback : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "mission_id" });
  if (error) return NextResponse.json({ error: "Não foi possível salvar o exercício." }, { status: 503 });
  return NextResponse.json({ saved: true }, { headers: { "Cache-Control": "private, no-store" } });
}
