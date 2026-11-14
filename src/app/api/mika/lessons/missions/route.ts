import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Read-only, owner-scoped mission discovery for MIKA Professora. */
export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === "preview" && (
    process.env.MIKA_TEACHER_HOMOLOGATION_READY !== "true" ||
    !/^https:\/\/xanavauqzsrgvdfhcrsm\.supabase\.co\/?$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  )) return NextResponse.json({ error: "Homologação não configurada." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação indisponível." }, { status: 503 });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  const journeyId = new URL(request.url).searchParams.get("journeyId");
  if (!journeyId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(journeyId))
    return NextResponse.json({ error: "Jornada inválida." }, { status: 400 });
  const { data: journey, error: journeyError } = await supabase.from("myryra_journeys")
    .select("id,title,status").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (journeyError) return NextResponse.json({ error: "Não foi possível consultar a jornada." }, { status: 503 });
  if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404 });
  if (journey.status !== "active") return NextResponse.json({ error: "Jornada não está ativa." }, { status: 409 });
  const { data: missions, error: missionsError } = await supabase.from("myryra_journey_missions")
    .select("id,title,status,due_at,completed_at").eq("journey_id", journeyId)
    .order("created_at", { ascending: true }).limit(100);
  if (missionsError) return NextResponse.json({ error: "Missões indisponíveis." }, { status: 503 });
  return NextResponse.json({ journey: { id: journey.id, title: journey.title }, missions: missions ?? [], progressUpdated: false }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
