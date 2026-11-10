import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ journeyId: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: Context) {
  const { journeyId } = await context.params;
  if (!uuid.test(journeyId)) return NextResponse.json({ error: "Jornada inválida." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  const { data: journey, error: journeyError } = await supabase.from("myryra_journeys")
    .select("id,title,status,target_date").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (journeyError) return NextResponse.json({ error: "Falha ao consultar jornada." }, { status: 500 });
  if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404 });
  const { data: missions, error: missionsError } = await supabase.from("myryra_journey_missions")
    .select("id,title,status,due_at,completed_at,created_at").eq("journey_id", journeyId)
    .order("created_at", { ascending: true }).limit(104);
  if (missionsError) return NextResponse.json({ error: "Falha ao consultar missões." }, { status: 500 });
  return NextResponse.json({ journey, missions: missions ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
