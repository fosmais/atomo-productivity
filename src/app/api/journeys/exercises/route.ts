import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasCurrentLegalAcceptance } from "@/lib/privacy/legal-acceptance";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Read-only endpoint. Issuing exercises requires a separate reviewed write path.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const journeyId = url.searchParams.get("journeyId");
  const missionId = url.searchParams.get("missionId");
  if (!journeyId || !uuid.test(journeyId) || !missionId || !uuid.test(missionId))
    return NextResponse.json({ error: "Jornada ou missão inválida." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  if (process.env.MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true" &&
      !(await hasCurrentLegalAcceptance(user.id))) {
    return NextResponse.json(
      { error: "Aceite dos documentos legais vigentes necessário.", code: "LEGAL_ACCEPTANCE_REQUIRED" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação indisponível." }, { status: 503 });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  const { data: journey, error: journeyError } = await supabase.from("myryra_journeys")
    .select("id").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (journeyError) return NextResponse.json({ error: "Jornada indisponível." }, { status: 503 });
  if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404 });
  const { data: mission, error: missionError } = await supabase.from("myryra_journey_missions")
    .select("id").eq("id", missionId).eq("journey_id", journeyId).maybeSingle();
  if (missionError) return NextResponse.json({ error: "Missão indisponível." }, { status: 503 });
  if (!mission) return NextResponse.json({ error: "Missão não encontrada." }, { status: 404 });
  const { data: exercise, error } = await supabase.from("myryra_journey_assigned_exercises")
    .select("id,mission_id,session_id,version,exercise,created_at")
    .eq("mission_id", missionId).eq("owner_id", user.id)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: "Exercício oficial indisponível." }, { status: 503 });
  return NextResponse.json({ exercise: exercise ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}
