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
