import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "private, no-store" };

async function authorize(journeyId: string, missionId?: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { supabase, user: null, status: 401 };
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return { supabase, user: null, status: 403 };
  const { data: journey, error } = await supabase.from("myryra_journeys")
    .select("id").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (error) return { supabase, user: null, status: 503 };
  if (!journey) return { supabase, user: null, status: 404 };
  if (missionId) {
    const { data: mission, error: missionError } = await supabase.from("myryra_journey_missions")
      .select("id").eq("id", missionId).eq("journey_id", journeyId).maybeSingle();
    if (missionError) return { supabase, user: null, status: 503 };
    if (!mission) return { supabase, user: null, status: 404 };
  }
  return { supabase, user, status: 200 };
}

export async function GET(request: Request) {
  const journeyId = new URL(request.url).searchParams.get("journeyId");
  if (!journeyId || !uuid.test(journeyId)) return NextResponse.json({ error: "Jornada inválida." }, { status: 400 });
  const { supabase, user, status } = await authorize(journeyId);
  if (!user) return NextResponse.json({ error: "Acesso indisponível ou não autorizado." }, { status });
  const { data: missions, error: missionsError } = await supabase.from("myryra_journey_missions")
    .select("id").eq("journey_id", journeyId).limit(104);
  if (missionsError) return NextResponse.json({ error: "Missões indisponíveis." }, { status: 503 });
  const ids = (missions ?? []).map(m => m.id);
  if (!ids.length) return NextResponse.json({ entries: [] }, { headers: noStore });
  const { data, error } = await supabase.from("myryra_journey_review_steps")
    .select("mission_id,steps").eq("owner_id", user.id).in("mission_id", ids);
  if (error) return NextResponse.json({ error: "Progresso de revisão indisponível." }, { status: 503 });
  return NextResponse.json({ entries: data ?? [] }, { headers: noStore });
}

export async function PUT(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return NextResponse.json({ error: "Envie JSON." }, { status: 415 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { journeyId, missionId, steps } = body as Record<string, unknown>;
  if (typeof journeyId !== "string" || !uuid.test(journeyId) ||
      typeof missionId !== "string" || !uuid.test(missionId) ||
      !Array.isArray(steps) || steps.length !== 3 || !steps.every(step => typeof step === "boolean"))
    return NextResponse.json({ error: "Etapas inválidas." }, { status: 400 });
  const { supabase, user, status } = await authorize(journeyId, missionId);
  if (!user) return NextResponse.json({ error: "Acesso indisponível ou não autorizado." }, { status });
  const { error } = await supabase.from("myryra_journey_review_steps").upsert({
    mission_id: missionId, owner_id: user.id, steps, updated_at: new Date().toISOString(),
  }, { onConflict: "mission_id" });
  if (error) return NextResponse.json({ error: "Não foi possível salvar a revisão." }, { status: 503 });
  return NextResponse.json({ saved: true }, { headers: noStore });
}
